
import React from 'react';
import { AspectRatio, ASPECT_RATIOS, Theme, THEMES, FontOption, FONTS } from '../types';

interface ControlPanelProps {
  itemCount: number;
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
  font: FontOption;
  setFont: (f: FontOption) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  itemCount,
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
  font,
  setFont,
}) => {
  return (
    <div className="h-full bg-slate-50 border-r border-slate-200 overflow-y-auto custom-scrollbar p-6 space-y-8 w-full md:w-96">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Duckline</h1>
        <p className="text-slate-500 text-sm">Get your ducks in a row</p>
      </div>

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
          <p className="text-[10px] text-slate-400 mt-1 ml-5">Waddle past the boring parts</p>
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
          <p className="text-[10px] text-slate-400 mt-1 ml-5">No need to quack out the obvious</p>
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
          <p className="text-[10px] text-slate-400 mt-1">Make your feathers bigger or smaller</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Plumage</label>
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
          <label className="block text-sm font-semibold text-slate-700 mb-2">Quill</label>
          <div className="grid grid-cols-2 gap-2">
            {FONTS.map((f) => (
              <button
                key={f.label}
                onClick={() => setFont(f)}
                className={`p-2 rounded-lg border text-xs font-medium transition text-left ${font.label === f.label ? 'border-blue-500 bg-blue-50' : 'bg-white border-slate-200'}`}
                style={{ fontFamily: f.family }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Pick your flock's handwriting</p>
        </div>

        <div className="relative bg-purple-50/60 border border-purple-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-semibold text-slate-700">Social Media Carousel</label>
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="6" height="12" rx="1" />
              <rect x="9" y="4" width="6" height="16" rx="1" />
              <rect x="16" y="6" width="6" height="12" rx="1" />
            </svg>
          </div>
          <button
            onClick={() => setShowCarouselPreview(!showCarouselPreview)}
            className={`w-full py-2 rounded-lg text-sm font-medium border transition ${
              showCarouselPreview
                ? 'bg-purple-100 border-purple-500 text-purple-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Carousel Mode {showCarouselPreview ? 'On' : 'Off'}
          </button>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="10"
              value={exportSlices}
              onChange={(e) => setExportSlices(parseInt(e.target.value))}
              className="flex-1 accent-purple-600"
            />
            <span className="text-sm font-bold text-purple-600 w-8">{exportSlices}x</span>
          </div>
          <p className="text-[10px] text-slate-400">How many ponds to swim across</p>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={avoidSplit}
              onChange={(e) => setAvoidSplit(e.target.checked)}
              className="rounded border-slate-300"
            />
            No duck left behind
          </label>
          <p className="text-[10px] text-slate-400 ml-5">Keep labels from getting split across slides. Increase slide count for best results.</p>
        </div>
      </section>

      <section className="pt-4 border-t border-slate-200 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Fly the Coop</h3>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => onExport('png')}
            className="w-full bg-white border border-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
            Download PNG
          </button>
          <button
            onClick={() => onExport('svg')}
            className="w-full bg-white border border-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            Download SVG
          </button>
          <button
            onClick={() => onExport('carousel')}
            className="w-full bg-purple-600 text-white py-3 rounded-lg text-sm font-bold hover:bg-purple-700 transition shadow-lg flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="6" height="12" rx="1" /><rect x="9" y="4" width="6" height="16" rx="1" /><rect x="16" y="6" width="6" height="12" rx="1" /></svg>
            Download Carousel
          </button>
        </div>
      </section>

      <div className="text-center pt-2 flex items-center justify-center gap-2">
        <a href="https://yifengsun.com" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-blue-500 transition">
          yifengsun.com
        </a>
        <span className="text-slate-300">|</span>
        <a href="mailto:ys@yifengsun.com?subject=Duckline%20Bug%20Report" className="text-xs text-slate-400 hover:text-blue-500 transition">
          Throw me a bug
        </a>
      </div>
    </div>
  );
};

export default ControlPanel;
