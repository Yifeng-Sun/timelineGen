
import React, { useState } from 'react';
import { TimelineItem, Orientation, Theme, THEMES } from '../types';

interface ControlPanelProps {
  items: TimelineItem[];
  setItems: React.Dispatch<React.SetStateAction<TimelineItem[]>>;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  exportSlices: number;
  setExportSlices: (n: number) => void;
  onExport: (format: 'png' | 'svg' | 'carousel') => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  items,
  setItems,
  orientation,
  setOrientation,
  theme,
  setTheme,
  exportSlices,
  setExportSlices,
  onExport
}) => {
  const [jsonInput, setJsonInput] = useState(JSON.stringify({
    "Born": "July 10, 2022",
    "First Word": "May 15, 2023",
    "Learning to walk": ["July 30, 2023", "September 10, 2023"],
    "Preschool": ["September 1, 2025", "June 30, 2026"]
  }, null, 2));

  const applyJson = () => {
    try {
      const data = JSON.parse(jsonInput);
      const newItems: TimelineItem[] = [];
      Object.entries(data).forEach(([label, value]: [string, any]) => {
        const id = Math.random().toString(36).substr(2, 9);
        if (Array.isArray(value)) {
          newItems.push({
            id,
            label,
            startDate: value[0],
            endDate: value[1],
            type: 'period'
          });
        } else {
          newItems.push({
            id,
            label,
            date: value,
            type: 'event'
          });
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
          <label className="block text-sm font-semibold text-slate-700 mb-2">Orientation</label>
          <div className="flex gap-2">
            <button
              onClick={() => setOrientation('landscape')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition ${orientation === 'landscape' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              Landscape
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition ${orientation === 'portrait' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              Portrait
            </button>
          </div>
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
