
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TimelineItem, AspectRatio, ASPECT_RATIOS, Theme, THEMES, FontOption, FONTS } from './types';
import TimelinePreview from './components/TimelinePreview';
import ControlPanel from './components/ControlPanel';
import AddItemPanel from './components/AddItemPanel';

const STORAGE_KEY = 'chronicle-flow-items';

const DEFAULT_ITEMS: TimelineItem[] = [
  { id: '1', label: 'Alarm quacks', date: 'Jun 7, 2025 6:00 AM', type: 'event' },
  { id: '2', label: 'Pond yoga', startDate: 'Jun 7, 2025 6:30 AM', endDate: 'Jun 7, 2025 7:15 AM', type: 'period' },
  { id: '3', label: 'Bread heist at the park', date: 'Jun 7, 2025 8:00 AM', type: 'event' },
  { id: '4', label: 'Food coma', date: 'Jun 7, 2025 9:00 AM', type: 'note' },
  { id: '5', label: 'Nap on a lily pad', startDate: 'Jun 7, 2025 10:00 AM', endDate: 'Jun 7, 2025 1:00 PM', type: 'period' },
  { id: '6', label: 'Synchronized swimming', date: 'Jun 7, 2025 2:30 PM', type: 'event' },
  { id: '7', label: 'Sunset waddle', date: 'Jun 7, 2025 6:00 PM', type: 'event' },
  { id: '8', label: 'Quack-aroke night', startDate: 'Jun 7, 2025 8:00 PM', endDate: 'Jun 7, 2025 11:00 PM', type: 'period' },
  { id: '9', label: 'Zzz under the stars', date: 'Jun 7, 2025 11:30 PM', type: 'event' },
];

function loadItems(): TimelineItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore corrupt data */ }
  return DEFAULT_ITEMS;
}

const App: React.FC = () => {
  const [items, setItems] = useState<TimelineItem[]>(loadItems);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(ASPECT_RATIOS[1]); // 3:2
  const [contentScale, setContentScale] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1);
  const [theme, setTheme] = useState<Theme>(THEMES.modern);
  const [font, setFont] = useState<FontOption>(FONTS[0]);
  const [exportSlices, setExportSlices] = useState<number>(3);
  const [isExporting, setIsExporting] = useState(false);
  const [showCarouselPreview, setShowCarouselPreview] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [compressGaps, setCompressGaps] = useState(false);
  const [avoidSplit, setAvoidSplit] = useState(false);
  const [compactDates, setCompactDates] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(true);

  // Persist items to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const mainPreviewRef = useRef<HTMLDivElement>(null);
  const hiddenContainerRef = useRef<HTMLDivElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);

  // Compute canvas dimensions from aspect ratio
  const isLandscape = aspectRatio.width >= aspectRatio.height;
  const baseWidth = isLandscape ? 1200 : Math.round(1200 * (aspectRatio.width / aspectRatio.height));
  const baseHeight = isLandscape ? Math.round(1200 * (aspectRatio.height / aspectRatio.width)) : 1200;

  useEffect(() => {
    setCurrentSlide(0);
  }, [exportSlices, showCarouselPreview]);

  // Ctrl+scroll zoom on preview area
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(prev => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        return Math.round(Math.min(3.0, Math.max(0.5, prev + delta)) * 10) / 10;
      });
    }
  }, []);

  // Called when a label is edited on the preview
  const handleItemUpdate = useCallback((id: string, changes: Partial<{ label: string }>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...changes } : item));
  }, []);

  const handleItemDelete = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleExport = async (format: 'png' | 'svg' | 'carousel') => {
    setIsExporting(true);

    const cleanSvg = (svg: SVGSVGElement): SVGSVGElement => {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.querySelectorAll('.delete-btn').forEach(el => el.remove());
      return clone;
    };

    if (format === 'svg') {
      const svgElement = mainPreviewRef.current?.querySelector('svg');
      if (svgElement) {
        const cleaned = cleanSvg(svgElement);
        const svgData = new XMLSerializer().serializeToString(cleaned);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `timeline-${new Date().getTime()}.svg`;
        link.click();
      }
    } else if (format === 'png') {
      const svgElement = mainPreviewRef.current?.querySelector('svg');
      if (svgElement) {
        const cleaned = cleanSvg(svgElement);
        const svgData = new XMLSerializer().serializeToString(cleaned);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = baseWidth;
            canvas.height = baseHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, baseWidth, baseHeight);
            const pngUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = pngUrl;
            link.download = `timeline-full.png`;
            link.click();
            URL.revokeObjectURL(url);
            resolve();
          };
          img.src = url;
        });
      }
    } else if (format === 'carousel') {
      const hiddenSvg = hiddenContainerRef.current?.querySelector('svg');
      if (!hiddenSvg) {
        setIsExporting(false);
        return;
      }

      for (let i = 0; i < exportSlices; i++) {
        const clonedSvg = hiddenSvg.cloneNode(true) as SVGSVGElement;
        clonedSvg.setAttribute('viewBox', `${i * baseWidth} 0 ${baseWidth} ${baseHeight}`);

        // Update branding text position for this slice
        const textElements = clonedSvg.querySelectorAll('text');
        const branding = Array.from(textElements).find(t => t.textContent?.includes('Duckline'));
        if (branding) {
          branding.setAttribute('x', String(i * baseWidth + baseWidth - 20));
        }

        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = baseWidth;
            canvas.height = baseHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, baseWidth, baseHeight);
            const pngUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = pngUrl;
            link.download = `timeline-slide-${i + 1}.png`;
            link.click();
            URL.revokeObjectURL(url);
            resolve();
          };
          img.src = url;
        });

        await new Promise(r => setTimeout(r, 300));
      }
    }

    setTimeout(() => setIsExporting(false), 500);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-slate-100 overflow-hidden">
      {/* Sidebar Controls */}
      <ControlPanel
        itemCount={items.length}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        contentScale={contentScale}
        setContentScale={setContentScale}
        theme={theme}
        setTheme={setTheme}
        font={font}
        setFont={setFont}
        exportSlices={exportSlices}
        setExportSlices={setExportSlices}
        onExport={handleExport}
        showCarouselPreview={showCarouselPreview}
        setShowCarouselPreview={setShowCarouselPreview}
        compressGaps={compressGaps}
        setCompressGaps={setCompressGaps}
        avoidSplit={avoidSplit}
        setAvoidSplit={setAvoidSplit}
        compactDates={compactDates}
        setCompactDates={setCompactDates}
      />

      {/* Main Preview Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div
          ref={previewAreaRef}
          className="flex-1 overflow-auto p-4 md:p-8 flex items-center justify-center"
          onWheel={handleWheel}
        >
          <div
            className="transition-all duration-500 ease-in-out"
            style={{
              width: isLandscape ? 'min(90%, 1200px)' : `min(70%, ${baseWidth}px)`,
              aspectRatio: `${aspectRatio.width}/${aspectRatio.height}`,
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            <div ref={mainPreviewRef}>
              {showCarouselPreview ? (
                <TimelinePreview
                  items={items}
                  theme={theme}
                  contentScale={contentScale}
                  exportMode={true}
                  sliceIndex={currentSlide}
                  totalSlices={exportSlices}
                  canvasWidth={baseWidth}
                  canvasHeight={baseHeight}
                  compressGaps={compressGaps}
                  avoidSplit={avoidSplit}
                  compactDates={compactDates}
                  font={font}
                  onItemUpdate={handleItemUpdate}
                  onItemDelete={handleItemDelete}
                />
              ) : (
                <TimelinePreview
                  items={items}
                  theme={theme}
                  contentScale={contentScale}
                  canvasWidth={baseWidth}
                  canvasHeight={baseHeight}
                  compressGaps={compressGaps}
                  compactDates={compactDates}
                  font={font}
                  onItemUpdate={handleItemUpdate}
                  onItemDelete={handleItemDelete}
                />
              )}
            </div>

            {showCarouselPreview && (
              <div className="mt-4 flex items-center justify-center gap-4">
                <button
                  onClick={() => setCurrentSlide((s: number) => Math.max(0, s - 1))}
                  disabled={currentSlide === 0}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  &larr; Prev
                </button>
                <div className="flex gap-1.5">
                  {Array.from({ length: exportSlices }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      className={`w-2.5 h-2.5 rounded-full transition ${i === currentSlide ? 'bg-blue-600 scale-125' : 'bg-slate-300 hover:bg-slate-400'}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setCurrentSlide((s: number) => Math.min(exportSlices - 1, s + 1))}
                  disabled={currentSlide === exportSlices - 1}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Floating Add Item button + panel */}
        <button
          onClick={() => setShowAddPanel(prev => !prev)}
          className={`fab-radar absolute bottom-16 right-4 z-30 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-2xl font-bold transition-transform duration-300 ${
            showAddPanel
              ? 'bg-slate-600 text-white rotate-45'
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-110'
          }`}
        >
          +
        </button>
        {showAddPanel && (
          <AddItemPanel
            items={items}
            setItems={setItems}
            onClose={() => setShowAddPanel(false)}
          />
        )}

        {/* Status bar with zoom controls */}
        <div className="flex justify-between items-center px-4 py-2 bg-white border-t border-slate-200">
          <div className="flex gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {items.length} Ducks
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-800">
              {aspectRatio.label}
            </span>
            {showCarouselPreview && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Slide {currentSlide + 1}/{exportSlices}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-xs font-medium text-slate-600 w-10 text-right">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(1)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Reset
            </button>
            <p className="text-[10px] text-slate-400 ml-2">Resolution: {baseWidth}x{baseHeight}</p>
          </div>
        </div>

        {isExporting && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-blue-900 font-bold text-lg animate-pulse">Hatching your masterpiece...</p>
            <p className="text-slate-500 text-sm">Preening high-resolution feathers</p>
          </div>
        )}
      </main>

      {/* Off-screen export container with full timeline for carousel slicing */}
      <div ref={hiddenContainerRef} className="fixed -left-[10000px] -top-[10000px]">
        <TimelinePreview
          items={items}
          theme={theme}
          contentScale={contentScale}
          exportMode={true}
          sliceIndex={0}
          totalSlices={exportSlices}
          canvasWidth={baseWidth}
          canvasHeight={baseHeight}
          compressGaps={compressGaps}
          avoidSplit={avoidSplit}
          compactDates={compactDates}
          font={font}
        />
      </div>
    </div>
  );
};

export default App;
