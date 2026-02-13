
import React, { useState, useEffect } from 'react';
import { TimelineItem, AspectRatio, ASPECT_RATIOS, Theme, THEMES } from '../types';

// Convert items array to the JSON editor format
function itemsToJson(items: TimelineItem[]): string {
  const obj: Record<string, object> = {};
  items.forEach(item => {
    if (item.type === 'event') {
      obj[item.label] = { type: 'event', date: item.date };
    } else if (item.type === 'period') {
      obj[item.label] = { type: 'period', startDate: item.startDate, endDate: item.endDate };
    } else {
      obj[item.label] = { type: 'note', date: item.date };
    }
  });
  return JSON.stringify(obj, null, 2);
}

interface ControlPanelProps {
  items: TimelineItem[];
  setItems: React.Dispatch<React.SetStateAction<TimelineItem[]>>;
  aspectRatio: AspectRatio;
  setAspectRatio: (ar: AspectRatio) => void;
  contentScale: number;
  setContentScale: (s: number) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  exportSlices: number;
  setExportSlices: (n: number) => void;
  onExport: (format: 'png' | 'svg' | 'carousel') => void;
  showCarouselPreview: boolean;
  setShowCarouselPreview: (show: boolean) => void;
  compressGaps: boolean;
  setCompressGaps: (v: boolean) => void;
  avoidSplit: boolean;
  setAvoidSplit: (v: boolean) => void;
  compactDates: boolean;
  setCompactDates: (v: boolean) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  items,
  setItems,
  aspectRatio,
  setAspectRatio,
  contentScale,
  setContentScale,
  theme,
  setTheme,
  exportSlices,
  setExportSlices,
  onExport,
  showCarouselPreview,
  setShowCarouselPreview,
  compressGaps,
  setCompressGaps,
  avoidSplit,
  setAvoidSplit,
  compactDates,
  setCompactDates,
}) => {
  const [jsonInput, setJsonInput] = useState(() => itemsToJson(items));

  // Sync jsonInput when items change (e.g. from preview editing)
  useEffect(() => {
    setJsonInput(itemsToJson(items));
  }, [items]);

  const applyJson = () => {
    try {
      const data = JSON.parse(jsonInput);
      const newItems: TimelineItem[] = [];
      Object.entries(data).forEach(([label, value]: [string, any]) => {
        const id = Math.random().toString(36).substr(2, 9);
        if (value.type === 'period') {
          newItems.push({ id, label, startDate: value.startDate, endDate: value.endDate, type: 'period' });
        } else if (value.type === 'note') {
          newItems.push({ id, label, date: value.date, type: 'note' });
        } else {
          newItems.push({ id, label, date: value.date, type: 'event' });
        }
      });
      setItems(newItems);
    } catch (e) {
      alert("Invalid JSON format. Please check your syntax.");
    }
  };

  return (
    <div className="h-full bg-slate-50 border-r border-slate-200 overflow-y-auto custom-scrollbar p-6 space-y-8 w-full md:w-96">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Chronicle Flow</h1>
        <p className="text-slate-500 text-sm">Design your timeline story</p>
      </div>

      <section>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Events & Periods (JSON)</label>
        <textarea
          className="w-full h-48 p-3 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
        />
        <button
          onClick={applyJson}
          className="mt-2 w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition shadow-sm"
        >
          Update Timeline
        </button>
      </section>

      <section className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Aspect Ratio</label>
          <div className="flex gap-1.5">
            {ASPECT_RATIOS.map((ar) => {
              const maxDim = 28;
              const scale = Math.min(maxDim / ar.width, maxDim / ar.height);
              const w = Math.round(ar.width * scale);
              const h = Math.round(ar.height * scale);
              const active = aspectRatio.label === ar.label;
              return (
                <button
                  key={ar.label}
                  title={ar.label}
                  onClick={() => setAspectRatio(ar)}
                  className={`flex items-center justify-center p-1.5 rounded-md border transition ${active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div
                    style={{ width: w, height: h }}
                    className={`rounded-sm ${active ? 'bg-blue-500' : 'bg-slate-300'}`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={compressGaps}
              onChange={(e) => setCompressGaps(e.target.checked)}
              className="rounded border-slate-300"
            />
            Compress long gaps
          </label>
          <p className="text-[10px] text-slate-400 mt-1 ml-5">Shrink empty stretches between items</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={compactDates}
              onChange={(e) => setCompactDates(e.target.checked)}
              className="rounded border-slate-300"
            />
            Smart date labels
          </label>
          <p className="text-[10px] text-slate-400 mt-1 ml-5">Show time only within a day, omit year within a year</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Content Size <span className="text-blue-600 font-bold ml-1">{contentScale.toFixed(1)}x</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={contentScale}
            onChange={(e) => setContentScale(parseFloat(e.target.value))}
            className="w-full"
          />
          <p className="text-[10px] text-slate-400 mt-1">Scale text, markers, and decorations</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Visual Theme</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(THEMES).map((t) => (
              <button
                key={t.name}
                onClick={() => setTheme(t)}
                className={`p-2 rounded-lg border text-xs font-medium transition text-left flex items-center gap-2 ${theme.name === t.name ? 'border-blue-500 bg-blue-50' : 'bg-white border-slate-200'}`}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.primary }}></div>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Social Media Carousel</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="10"
              value={exportSlices}
              onChange={(e) => setExportSlices(parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm font-bold text-blue-600 w-8">{exportSlices}x</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Number of slides for seamless Instagram carousel</p>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={avoidSplit}
              onChange={(e) => setAvoidSplit(e.target.checked)}
              className="rounded border-slate-300"
            />
            Keep items within slides
          </label>
          <button
            onClick={() => setShowCarouselPreview(!showCarouselPreview)}
            className={`mt-2 w-full py-2 rounded-lg text-sm font-medium border transition ${
              showCarouselPreview
                ? 'bg-purple-50 border-purple-500 text-purple-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Carousel Mode {showCarouselPreview ? 'On' : 'Off'}
          </button>
        </div>
      </section>

      <section className="pt-4 border-t border-slate-200 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Export Options</h3>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => onExport('png')}
            className="w-full bg-white border border-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            Download PNG Image
          </button>
          <button
            onClick={() => onExport('svg')}
            className="w-full bg-white border border-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            Download SVG Source
          </button>
          <button
            onClick={() => onExport('carousel')}
            className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-lg flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Generate Seamless Sequence
          </button>
        </div>
      </section>
    </div>
  );
};

export default ControlPanel;
