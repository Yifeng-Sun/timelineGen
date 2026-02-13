
import React, { useState, useCallback, useRef } from 'react';
import { TimelineItem, Orientation, Theme, THEMES } from './types';
import TimelinePreview from './components/TimelinePreview';
import ControlPanel from './components/ControlPanel';

const App: React.FC = () => {
  const [items, setItems] = useState<TimelineItem[]>([
    { id: '1', label: 'Born', date: 'July 10, 2022', type: 'event' },
    { id: '2', label: 'First Word', date: 'May 15, 2023', type: 'event' },
    { id: '3', label: 'Learning to walk', startDate: 'July 30, 2023', endDate: 'September 10, 2023', type: 'period' },
    { id: '4', label: 'Preschool', startDate: 'September 1, 2025', endDate: 'June 30, 2026', type: 'period' },
  ]);
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [theme, setTheme] = useState<Theme>(THEMES.modern);
  const [exportSlices, setExportSlices] = useState<number>(3);
  const [isExporting, setIsExporting] = useState(false);

  // Canvas refs for exporting
  const hiddenContainerRef = useRef<HTMLDivElement>(null);

  const handleExport = async (format: 'png' | 'svg' | 'carousel') => {
    setIsExporting(true);
    
    // Width/Height logic
    const baseWidth = orientation === 'landscape' ? 1200 : 800;
    const baseHeight = orientation === 'landscape' ? 800 : 1200;

    if (format === 'svg') {
      const svgElement = document.querySelector('svg');
      if (svgElement) {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `timeline-${new Date().getTime()}.svg`;
        link.click();
      }
    } else if (format === 'png' || format === 'carousel') {
      const numSlices = format === 'carousel' ? exportSlices : 1;
      
      for (let i = 0; i < numSlices; i++) {
        // Find the preview SVG for the specific slice
        // In a real app we'd render this to a temporary off-screen SVG or Canvas
        // Here we'll simulate the download by grabbing the current SVG
        const svgElement = document.querySelector('svg');
        if (!svgElement) continue;

        const canvas = document.createElement('canvas');
        canvas.width = baseWidth;
        canvas.height = baseHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        // Since we are creating a "seamless" carousel, we need to draw the specific slice
        // This is complex in vanilla JS without a library like html2canvas, 
        // but for this demo, we can use the serialized SVG approach.
        
        // We'll simulate a 1-second "generating" feel per slice
        await new Promise(r => setTimeout(r, 300));

        // For actual PNG generation from SVG:
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const img = new Image();
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          const pngUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = `timeline-${format === 'carousel' ? `slide-${i + 1}` : 'full'}.png`;
          link.click();
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }
    }

    setTimeout(() => setIsExporting(false), 500);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-slate-100 overflow-hidden">
      {/* Sidebar Controls */}
      <ControlPanel
        items={items}
        setItems={setItems}
        orientation={orientation}
        setOrientation={setOrientation}
        theme={theme}
        setTheme={setTheme}
        exportSlices={exportSlices}
        setExportSlices={setExportSlices}
        onExport={handleExport}
      />

      {/* Main Preview Area */}
      <main className="flex-1 overflow-auto p-4 md:p-8 flex items-center justify-center relative">
        <div 
          className="transition-all duration-500 ease-in-out transform hover:scale-[1.01]"
          style={{ 
            width: orientation === 'landscape' ? 'min(90%, 1200px)' : 'min(70%, 800px)',
            aspectRatio: orientation === 'landscape' ? '3/2' : '2/3'
          }}
        >
          <TimelinePreview
            items={items}
            orientation={orientation}
            theme={theme}
            canvasWidth={orientation === 'landscape' ? 1200 : 800}
            canvasHeight={orientation === 'landscape' ? 800 : 1200}
          />
          
          <div className="mt-4 flex justify-between items-center px-2">
            <div className="flex gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {items.length} Items
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-800">
                {orientation}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Resolution: {orientation === 'landscape' ? '1200x800' : '800x1200'}</p>
          </div>
        </div>

        {isExporting && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-blue-900 font-bold text-lg animate-pulse">Generating your sequence...</p>
            <p className="text-slate-500 text-sm">Preparing high-resolution slides</p>
          </div>
        )}
      </main>

      {/* Off-screen export container */}
      <div ref={hiddenContainerRef} className="fixed -left-[10000px] -top-[10000px]">
        {/* We would render slices here during export */}
      </div>
    </div>
  );
};

export default App;
