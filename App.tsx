
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(ASPECT_RATIOS[5]); // 9:16
  const [contentScale, setContentScale] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1);
  const [theme, setTheme] = useState<Theme>(THEMES.modern);
  const [font, setFont] = useState<FontOption>(FONTS[0]);
  const [exportSlices, setExportSlices] = useState<number>(3);
  const [isExporting, setIsExporting] = useState(false);
  const [showCarouselPreview, setShowCarouselPreview] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [compressGaps, setCompressGaps] = useState(false);
  const [avoidSplit, setAvoidSplit] = useState(false);
  const [compactDates, setCompactDates] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(true);
  const [clearedItems, setClearedItems] = useState<TimelineItem[] | null>(null);
  const [showOverlapWarning, setShowOverlapWarning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Detect overlapping periods (period-period or event/note inside a period)
  const hasOverlappingPeriods = useMemo(() => {
    const periods = items.filter((i): i is Extract<TimelineItem, { type: 'period' }> => i.type === 'period');
    // Period-period overlap
    for (let i = 0; i < periods.length; i++) {
      for (let j = i + 1; j < periods.length; j++) {
        const a0 = new Date(periods[i].startDate).getTime();
        const a1 = new Date(periods[i].endDate).getTime();
        const b0 = new Date(periods[j].startDate).getTime();
        const b1 = new Date(periods[j].endDate).getTime();
        if (a0 < b1 && b0 < a1) return true;
      }
    }
    // Event/note falling inside a period
    const points = items.filter(i => i.type === 'event' || i.type === 'note') as Array<{ date: string }>;
    for (const pt of points) {
      const t = new Date(pt.date).getTime();
      for (const p of periods) {
        const p0 = new Date(p.startDate).getTime();
        const p1 = new Date(p.endDate).getTime();
        if (t > p0 && t < p1) return true;
      }
    }
    return false;
  }, [items]);

  // Auto-disable avoidSplit when overlapping periods appear
  useEffect(() => {
    if (hasOverlappingPeriods && avoidSplit) {
      setAvoidSplit(false);
      setShowOverlapWarning(true);
    }
  }, [hasOverlappingPeriods]);

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

  // Instagram-style drag to change slides
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; locked: boolean | null; pointerId: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!showCarouselPreview) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, locked: null, pointerId: e.pointerId };
    setIsDragging(false);
    setDragOffset(0);
  }, [showCarouselPreview]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    // Lock direction after 10px of movement
    if (dragRef.current.locked === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      dragRef.current.locked = Math.abs(dx) > Math.abs(dy); // true = horizontal
    }
    if (dragRef.current.locked !== true) return;
    setIsDragging(true);
    // Rubber-band at edges
    let offset = dx;
    if ((currentSlide === 0 && dx > 0) || (currentSlide === exportSlices - 1 && dx < 0)) {
      offset = dx * 0.3;
    }
    setDragOffset(offset);
  }, [currentSlide, exportSlices]);

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current) return;
    const wasDragging = isDragging;
    dragRef.current = null;
    if (!wasDragging) { setDragOffset(0); setIsDragging(false); return; }
    // Snap: if dragged more than 20% of container width, change slide
    const container = previewAreaRef.current;
    const threshold = container ? container.clientWidth * 0.2 : 80;
    if (dragOffset < -threshold && currentSlide < exportSlices - 1) {
      setCurrentSlide(s => s + 1);
    } else if (dragOffset > threshold && currentSlide > 0) {
      setCurrentSlide(s => s - 1);
    }
    setDragOffset(0);
    setIsDragging(false);
  }, [isDragging, dragOffset, currentSlide, exportSlices]);

  const handlePointerCancel = useCallback(() => {
    dragRef.current = null;
    setDragOffset(0);
    setIsDragging(false);
  }, []);

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

  const handleClear = useCallback(() => {
    setClearedItems(items);
    setItems([]);
  }, [items]);

  const handleUndo = useCallback(() => {
    if (clearedItems) {
      setItems(clearedItems);
      setClearedItems(null);
    }
  }, [clearedItems]);

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
      {/* Sidebar toggle button (small screens) */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 w-10 h-10 rounded-lg bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
        title="Open settings"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      {/* Sidebar backdrop (small screens) */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Controls */}
      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden absolute top-3 right-3 z-10 w-8 h-8 rounded-lg bg-slate-200/80 flex items-center justify-center text-slate-500 hover:bg-slate-300 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
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
        hasOverlappingPeriods={hasOverlappingPeriods}
      />
      </div>

      {/* Main Preview Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {items.length > 0 && (
          <button
            onClick={handleClear}
            className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 hover:text-red-700 transition shadow-sm flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
            Clear canvas
          </button>
        )}
        <div
          ref={previewAreaRef}
          className={`flex-1 overflow-hidden p-4 md:p-8 flex items-center justify-center relative ${showCarouselPreview ? 'select-none' : 'overflow-auto'}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {showCarouselPreview && !isDragging && (
            <>
              <button
                onClick={() => setCurrentSlide((s: number) => Math.max(0, s - 1))}
                disabled={currentSlide === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 transition disabled:opacity-0 disabled:pointer-events-none"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                onClick={() => setCurrentSlide((s: number) => Math.min(exportSlices - 1, s + 1))}
                disabled={currentSlide === exportSlices - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 transition disabled:opacity-0 disabled:pointer-events-none"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </>
          )}

          {showCarouselPreview ? (
            <div
              style={{
                width: isLandscape ? 'min(90%, 1200px)' : `min(70%, ${baseWidth}px)`,
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            >
              <div className="overflow-hidden rounded-lg" style={{ aspectRatio: `${aspectRatio.width}/${aspectRatio.height}` }}>
                <div
                  className={isDragging ? '' : 'transition-transform duration-300 ease-out'}
                  style={{
                    display: 'flex',
                    width: `${exportSlices * 100}%`,
                    transform: `translateX(calc(-${currentSlide * (100 / exportSlices)}% + ${dragOffset}px))`,
                  }}
                >
                  {Array.from({ length: exportSlices }, (_, i) => (
                    <div key={i} style={{ width: `${100 / exportSlices}%`, flexShrink: 0 }} ref={i === 0 ? mainPreviewRef : undefined}>
                      <TimelinePreview
                        items={items}
                        theme={theme}
                        contentScale={contentScale}
                        exportMode={true}
                        sliceIndex={i}
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
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                {Array.from({ length: exportSlices }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentSlide ? 'bg-purple-600 scale-125' : 'bg-slate-300 hover:bg-slate-400'}`}
                  />
                ))}
              </div>
            </div>
          ) : (
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
              </div>
            </div>
          )}
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

        {clearedItems && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 animate-bounce-once">
            <span className="text-sm">Canvas cleared</span>
            <button
              onClick={handleUndo}
              className="text-sm font-bold text-blue-300 hover:text-blue-100 transition"
            >
              Undo
            </button>
            <button
              onClick={() => setClearedItems(null)}
              className="text-slate-400 hover:text-white transition text-lg leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {showOverlapWarning && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">No duck left behind disabled</h3>
                  <p className="text-sm text-slate-500 mt-1">Your timeline has overlapping periods.</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                When periods overlap, their labels share the same timeline space. The slide-splitting algorithm needs a clear left-to-right order to push labels apart, but overlapping periods create circular dependencies &mdash; pushing one label out of a boundary can shove an overlapping neighbor back in. This makes a clean split different to guarantee. Please submit a Pull Request if you have ideas on how to handle this!
              </p>
              <p className="text-xs text-slate-400">Remove the overlap to re-enable this feature.</p>
              <button
                onClick={() => setShowOverlapWarning(false)}
                className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
              >
                Got it
              </button>
            </div>
          </div>
        )}

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
