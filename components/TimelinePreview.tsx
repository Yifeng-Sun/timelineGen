
import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { TimelineItem, Theme } from '../types';
import { parseDate, formatDate, getMinMaxDates } from '../utils/dateUtils';

const MIN_PERIOD_WIDTH = 60;
const GAP_COMPRESS_RATIO = 3; // gaps > 3x median get compressed

// Approximate text width in SVG pixels
function estimateTextWidth(text: string, fontSize: number, bold = false): number {
  return text.length * fontSize * (bold ? 0.62 : 0.52);
}

interface TimelinePreviewProps {
  items: TimelineItem[];
  theme: Theme;
  contentScale?: number;
  exportMode?: boolean;
  sliceIndex?: number;
  totalSlices?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  compressGaps?: boolean;
  avoidSplit?: boolean;
  compactDates?: boolean;
  onItemUpdate?: (id: string, changes: Partial<{ label: string }>) => void;
  onItemDelete?: (id: string) => void;
}

// Detect if all items fall within a single day or year
function detectDateSpan(items: TimelineItem[]): { mode: 'time' | 'monthday' | 'full'; label: string } {
  const dates: Date[] = [];
  items.forEach(item => {
    if (item.type === 'event' || item.type === 'note') {
      dates.push(parseDate(item.date));
    } else {
      dates.push(parseDate(item.startDate));
      dates.push(parseDate(item.endDate));
    }
  });
  if (dates.length === 0) return { mode: 'full', label: '' };

  const allSameDay = dates.every(d =>
    d.getFullYear() === dates[0].getFullYear() &&
    d.getMonth() === dates[0].getMonth() &&
    d.getDate() === dates[0].getDate()
  );
  if (allSameDay) {
    return {
      mode: 'time',
      label: dates[0].toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
    };
  }

  const allSameYear = dates.every(d => d.getFullYear() === dates[0].getFullYear());
  if (allSameYear) {
    return { mode: 'monthday', label: String(dates[0].getFullYear()) };
  }

  return { mode: 'full', label: '' };
}

function formatCompact(date: Date, mode: 'time' | 'monthday' | 'full'): string {
  if (mode === 'time') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (mode === 'monthday') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return formatDate(date);
}

// Build a compressed scale that shrinks long empty gaps
function buildCompressedScale(
  items: TimelineItem[],
  minDate: Date,
  maxDate: Date,
  rangeStart: number,
  rangeEnd: number,
) {
  const timestamps: number[] = [minDate.getTime(), maxDate.getTime()];
  items.forEach(item => {
    if (item.type === 'event' || item.type === 'note') {
      timestamps.push(parseDate(item.date).getTime());
    } else {
      timestamps.push(parseDate(item.startDate).getTime());
      timestamps.push(parseDate(item.endDate).getTime());
    }
  });

  const unique = [...new Set(timestamps)].sort((a, b) => a - b);
  if (unique.length < 2) {
    return { scale: (d: Date) => rangeStart, breaks: [] as number[] };
  }

  const gaps: number[] = [];
  for (let i = 1; i < unique.length; i++) {
    gaps.push(unique[i] - unique[i - 1]);
  }

  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const median = sortedGaps[Math.floor(sortedGaps.length / 2)];
  const threshold = median * GAP_COMPRESS_RATIO;

  // Build cumulative compressed distances
  let cum = 0;
  const compressed = [0];
  const breakIndices: number[] = [];

  for (let i = 0; i < gaps.length; i++) {
    if (threshold > 0 && gaps[i] > threshold) {
      cum += threshold;
      breakIndices.push(i);
    } else {
      cum += gaps[i];
    }
    compressed.push(cum);
  }

  if (cum === 0) {
    return { scale: (d: Date) => (rangeStart + rangeEnd) / 2, breaks: [] as number[] };
  }

  const totalRange = rangeEnd - rangeStart;

  const scale = (d: Date): number => {
    const t = d.getTime();
    if (t <= unique[0]) return rangeStart;
    if (t >= unique[unique.length - 1]) return rangeEnd;

    // Find segment
    let seg = 0;
    for (let i = 0; i < unique.length - 1; i++) {
      if (t >= unique[i] && t <= unique[i + 1]) { seg = i; break; }
      if (t > unique[i]) seg = i;
    }

    const frac = unique[seg + 1] === unique[seg]
      ? 0
      : (t - unique[seg]) / (unique[seg + 1] - unique[seg]);

    const compVal = compressed[seg] + frac * (compressed[seg + 1] - compressed[seg]);
    return rangeStart + (compVal / cum) * totalRange;
  };

  // Break positions (midpoint of compressed gap)
  const breaks = breakIndices.map(i => {
    const compMid = (compressed[i] + compressed[i + 1]) / 2;
    return rangeStart + (compMid / cum) * totalRange;
  });

  return { scale, breaks };
}

const TimelinePreview: React.FC<TimelinePreviewProps> = ({
  items,
  theme,
  contentScale = 1,
  exportMode = false,
  sliceIndex = 0,
  totalSlices = 1,
  canvasWidth = 1200,
  canvasHeight = 800,
  compressGaps = false,
  avoidSplit = false,
  compactDates = false,
  onItemUpdate,
  onItemDelete,
}) => {
  const s = contentScale;
  const { min, max } = useMemo(() => getMinMaxDates(items), [items]);

  // Smart date formatting
  const { dateMode, dateLabel, fmt } = useMemo(() => {
    if (!compactDates) return { dateMode: 'full' as const, dateLabel: '', fmt: (d: Date) => formatDate(d) };
    const span = detectDateSpan(items);
    return { dateMode: span.mode, dateLabel: span.label, fmt: (d: Date) => formatCompact(d, span.mode) };
  }, [items, compactDates]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const commitEdit = () => {
    if (editingId && onItemUpdate && editValue.trim()) {
      onItemUpdate(editingId, { label: editValue.trim() });
    }
    setEditingId(null);
  };

  const startEdit = (id: string, currentLabel: string) => {
    if (!onItemUpdate) return;
    setEditingId(id);
    setEditValue(currentLabel);
  };

  const actualWidth = exportMode ? canvasWidth * totalSlices : canvasWidth;
  const actualHeight = canvasHeight;
  const rangeStart = actualWidth * 0.1;
  const rangeEnd = actualWidth * 0.9;

  // Build scale — either compressed or linear
  const { xScale, gapBreaks } = useMemo(() => {
    if (compressGaps && items.length >= 2) {
      const { scale, breaks } = buildCompressedScale(items, min, max, rangeStart, rangeEnd);
      return { xScale: scale, gapBreaks: breaks };
    }
    const linear = d3.scaleTime().domain([min, max]).range([rangeStart, rangeEnd]);
    return { xScale: (d: Date) => linear(d), gapBreaks: [] as number[] };
  }, [items, min, max, rangeStart, rangeEnd, compressGaps]);

  const getItemDate = (item: TimelineItem): Date => {
    if (item.type === 'event' || item.type === 'note') return parseDate(item.date);
    return parseDate(item.startDate);
  };

  const sortedItems = [...items].sort((a, b) =>
    getItemDate(a).getTime() - getItemDate(b).getTime()
  );

  const editable = !!onItemUpdate;
  const y = actualHeight / 2;

  // --- Layout computation: dynamic sizing + collision avoidance ---
  const layoutMap = useMemo(() => {
    const snap = (x: number, hw: number): number => {
      if (!avoidSplit || !exportMode || totalSlices <= 1) return x;
      for (let i = 1; i < totalSlices; i++) {
        const boundary = i * canvasWidth;
        if (x - hw < boundary && x + hw > boundary) {
          return (boundary - (x - hw) < (x + hw) - boundary)
            ? boundary - hw - 4
            : boundary + hw + 4;
        }
      }
      return x;
    };

    interface LayoutEntry {
      side: -1 | 1;
      yExtra: number;
      rawX: number;   // true timeline position (marker dot goes here)
      cx: number;     // label center (may be shifted to avoid overlaps)
      halfW: number;
      // Band = distance from timeline where label content lives [bandStart, bandStart+bandHeight]
      bandStart: number;
      bandHeight: number;
      x1?: number;
      x2?: number;
    }

    // Band definitions match the ACTUAL rendering positions (distance from y)
    // Events:  connector 100*s, gap 10*s, box 50*s → top: [110, 160], bottom: [110, 160]
    // Periods: top label at 45, date at 65+~7 → [38, 72]; bottom label at 55-7, date at 75+7 → [48, 82]
    // Notes:   top label at 66+, date at 80+ → [62, 90]; bottom label at 84-, date at 98- → [70, 100]
    const bandDefs = {
      event:  { start: 110 * s, height: 55 * s },
      period: { start: 36 * s, height: 40 * s },
      note:   { top: { start: 58 * s, height: 36 * s }, bottom: { start: 66 * s, height: 36 * s } },
    };

    const entries: { id: string; entry: LayoutEntry }[] = [];

    sortedItems.forEach((item, idx) => {
      const side: -1 | 1 = idx % 2 === 0 ? -1 : 1;

      if (item.type === 'event') {
        const rawX = xScale(parseDate(item.date));
        const labelW = estimateTextWidth(item.label, 14 * s, true);
        const dateW = estimateTextWidth(fmt(parseDate(item.date)), 11 * s);
        const halfW = Math.max(labelW, dateW, 100 * s) / 2 + 12 * s;
        const cx = snap(rawX, halfW);
        entries.push({ id: item.id, entry: {
          side, yExtra: 0, rawX, cx, halfW,
          bandStart: bandDefs.event.start, bandHeight: bandDefs.event.height,
        }});
      } else if (item.type === 'period') {
        const x1 = xScale(parseDate(item.startDate));
        const x2raw = xScale(parseDate(item.endDate));
        const spanW = Math.max(x2raw - x1, MIN_PERIOD_WIDTH * s);
        const x2 = x1 + spanW;

        const labelW = estimateTextWidth(item.label, 14 * s, true);
        const dateStr = `${fmt(parseDate(item.startDate))} - ${fmt(parseDate(item.endDate))}`;
        const dateW = estimateTextWidth(dateStr, 11 * s);
        const halfW = Math.max(labelW, dateW, x2 - x1) / 2 + 8 * s;
        const labelCx = (x1 + x2) / 2;

        entries.push({ id: item.id, entry: {
          // Periods always render labels above, so use top side for collision
          side: -1 as (-1 | 1), yExtra: 0, rawX: (x1 + x2) / 2, cx: labelCx, halfW,
          bandStart: bandDefs.period.start, bandHeight: bandDefs.period.height,
          x1, x2,
        }});
      } else {
        const rawX = xScale(parseDate(item.date));
        const labelW = estimateTextWidth(item.label, 12 * s);
        const dateW = estimateTextWidth(fmt(parseDate(item.date)), 9 * s);
        const halfW = Math.max(labelW, dateW) / 2 + 8 * s;
        const cx = snap(rawX, halfW);
        const bd = side === -1 ? bandDefs.note.top : bandDefs.note.bottom;
        entries.push({ id: item.id, entry: {
          side, yExtra: 0, rawX, cx, halfW,
          bandStart: bd.start, bandHeight: bd.height,
        }});
      }
    });

    // Collision resolution per side — multiple passes for cascading pushes
    for (const sideVal of [-1, 1] as (-1 | 1)[]) {
      const sideEntries = entries.filter(e => e.entry.side === sideVal);
      sideEntries.sort((a, b) => a.entry.cx - b.entry.cx);
      for (let i = 0; i < sideEntries.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = sideEntries[j].entry;
          const b = sideEntries[i].entry;
          if (a.cx + a.halfW <= b.cx - b.halfW) continue;
          if (b.cx + b.halfW <= a.cx - a.halfW) continue;
          const aEnd = a.bandStart + a.yExtra + a.bandHeight;
          const bStart = b.bandStart + b.yExtra;
          if (bStart < aEnd) {
            b.yExtra = aEnd - b.bandStart + 10 * s;
          }
        }
      }
    }

    // Horizontal shift: push event/note labels so they don't overlap period bars on the timeline
    // (only in normal mode — in export mode, snap handles boundary avoidance)
    if (!exportMode) {
      const periodBars = entries.filter(e => e.entry.x1 != null);
      for (const e of entries) {
        if (e.entry.x1 != null) continue; // skip periods themselves
        const ent = e.entry;
        for (const p of periodBars) {
          const px1 = p.entry.x1!;
          const px2 = p.entry.x2!;
          const labelLeft = ent.cx - ent.halfW;
          const labelRight = ent.cx + ent.halfW;
          // Only shift if the label box overlaps the period bar AND the marker is outside the bar
          if (labelRight > px1 && labelLeft < px2 && (ent.rawX < px1 || ent.rawX > px2)) {
            if (ent.rawX < px1) {
              // Marker is to the left of the period — shift label left so its right edge clears px1
              const newCx = px1 - ent.halfW - 4 * s;
              if (newCx > ent.rawX - ent.halfW * 2) { // don't shift too far
                ent.cx = newCx;
              }
            } else {
              // Marker is to the right — shift label right so its left edge clears px2
              const newCx = px2 + ent.halfW + 4 * s;
              if (newCx < ent.rawX + ent.halfW * 2) {
                ent.cx = newCx;
              }
            }
          }
        }
      }
    }

    // Bind marker dot to the same slide as its label
    if (exportMode && totalSlices > 1) {
      for (const e of entries) {
        const ent = e.entry;
        const rawSlide = Math.floor(ent.rawX / canvasWidth);
        const cxSlide = Math.floor(ent.cx / canvasWidth);
        if (rawSlide !== cxSlide) {
          ent.rawX = ent.cx;
        }
      }
    }

    const map = new Map<string, LayoutEntry>();
    entries.forEach(e => map.set(e.id, e.entry));
    return map;
  }, [sortedItems, xScale, s, avoidSplit, exportMode, totalSlices, canvasWidth, fmt]);

  return (
    <div className="relative bg-white shadow-xl rounded-lg overflow-hidden flex items-center justify-center border border-slate-200">
      <svg
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`${sliceIndex * canvasWidth} 0 ${canvasWidth} ${canvasHeight}`}
        className="w-full h-full"
        style={{ backgroundColor: theme.bg }}
      >
        <defs>
          <linearGradient id="mainLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.primary} stopOpacity="0.2" />
            <stop offset="50%" stopColor={theme.primary} stopOpacity="1" />
            <stop offset="100%" stopColor={theme.primary} stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Main Timeline Line */}
        <line
          x1={xScale(min)} y1={y} x2={xScale(max)} y2={y}
          stroke={theme.primary} strokeWidth={4 * s}
          strokeLinecap="round" strokeDasharray={`${8 * s},${8 * s}`} opacity="0.3"
        />
        <line
          x1={xScale(min)} y1={y} x2={xScale(max)} y2={y}
          stroke="url(#mainLineGradient)" strokeWidth={2 * s} strokeLinecap="round"
        />

        {/* Gap break marks (zigzag) */}
        {gapBreaks.map((bx, i) => {
          const z = 8 * s;
          return (
            <g key={`break-${i}`}>
              <line x1={bx - z} y1={y - z * 1.5} x2={bx - z} y2={y + z * 1.5}
                stroke={theme.bg} strokeWidth={z * 2.5} />
              <polyline
                points={`${bx - z},${y - z} ${bx - z / 2},${y - z / 2} ${bx},${y} ${bx + z / 2},${y + z / 2} ${bx + z},${y + z}`}
                fill="none" stroke={theme.muted} strokeWidth={1.5 * s} opacity="0.5"
              />
            </g>
          );
        })}

        {/* Periods */}
        {sortedItems.filter(i => i.type === 'period').map((item: any) => {
          const layout = layoutMap.get(item.id)!;
          const x1 = layout.x1!;
          const x2 = layout.x2!;
          const cx = layout.cx;
          const isTop = layout.side === -1;
          const yExtra = layout.yExtra;
          const height = 60 * s;
          const isEditing = editingId === item.id;
          // Always render period annotations above the bar
          const labelY = y - (45 * s + yExtra);
          const dateY = y - (65 * s + yExtra);
          return (
            <g key={item.id}>
              <rect
                x={x1} y={y - height / 2} width={x2 - x1} height={height}
                fill={theme.secondary} rx={30 * s} opacity="0.6"
              />
              <line
                x1={cx} y1={y - height / 2}
                x2={cx} y2={labelY + 8 * s}
                stroke={theme.accent} strokeWidth={1 * s} opacity="0.35"
                strokeDasharray={`${4 * s},${3 * s}`}
              />
              <g className="annotation">
                {isEditing ? (
                  <foreignObject
                    x={cx - 75 * s}
                    y={labelY - 14 * s}
                    width={150 * s} height={24 * s}
                  >
                    <input
                      ref={inputRef} value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      style={{ width: '100%', height: '100%', fontSize: `${14 * s}px`, fontWeight: 600,
                        textAlign: 'center', border: `1.5px solid ${theme.primary}`, borderRadius: `${4 * s}px`,
                        outline: 'none', background: theme.bg, color: theme.accent, padding: 0 }}
                    />
                  </foreignObject>
                ) : (
                  <text
                    x={cx} y={labelY}
                    textAnchor="middle" fontSize={14 * s} fontWeight="600" fill={theme.accent}
                    className="select-none" style={editable ? { cursor: 'pointer' } : undefined}
                    onClick={() => startEdit(item.id, item.label)}
                  >{item.label}</text>
                )}
                <text
                  x={cx} y={dateY}
                  textAnchor="middle" fontSize={11 * s} fill={theme.muted} className="select-none"
                >
                  {fmt(parseDate(item.startDate))} - {fmt(parseDate(item.endDate))}
                </text>
                {onItemDelete && (
                  <g
                    transform={`translate(${cx + layout.halfW}, ${dateY - 6 * s})`}
                    style={{ cursor: 'pointer' }} className="delete-btn"
                    onClick={() => onItemDelete(item.id)}
                  >
                    <circle r={8 * s} fill="#ef4444" opacity="0.85" />
                    <line x1={-3 * s} y1={-3 * s} x2={3 * s} y2={3 * s} stroke="white" strokeWidth={1.5 * s} strokeLinecap="round" />
                    <line x1={3 * s} y1={-3 * s} x2={-3 * s} y2={3 * s} stroke="white" strokeWidth={1.5 * s} strokeLinecap="round" />
                  </g>
                )}
              </g>
            </g>
          );
        })}

        {/* Events */}
        {sortedItems.filter(i => i.type === 'event').map((item: any) => {
          const layout = layoutMap.get(item.id)!;
          const markerX = layout.rawX;
          const labelX = layout.cx;
          const isTop = layout.side === -1;
          const halfW = layout.halfW;
          const boxW = halfW * 2;
          const boxH = 50 * s;
          const connLen = 100 * s + layout.yExtra;
          const connEnd = isTop ? y - connLen : y + connLen;
          const boxY = isTop ? y - connLen - boxH - 10 * s : y + connLen + 10 * s;
          const isEditing = editingId === item.id;

          return (
            <g key={item.id}>
              <line x1={markerX} y1={y} x2={markerX} y2={connEnd}
                stroke={theme.primary} strokeWidth={1.5 * s} opacity="0.5" />
              <circle cx={markerX} cy={y} r={8 * s} fill={theme.bg} stroke={theme.primary} strokeWidth={3 * s} />
              <g transform={`translate(${labelX - halfW}, ${boxY})`} className="annotation">
                <rect
                  width={boxW} height={boxH} rx={12 * s} fill={theme.bg}
                  stroke={editable ? theme.primary : theme.secondary} strokeWidth={1 * s}
                  opacity={editable ? 0.8 : 1} style={editable ? { cursor: 'pointer' } : undefined}
                  onClick={() => startEdit(item.id, item.label)}
                />
                {isEditing ? (
                  <foreignObject x={4 * s} y={4 * s} width={boxW - 8 * s} height={22 * s}>
                    <input
                      ref={inputRef} value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      style={{ width: '100%', height: '100%', fontSize: `${14 * s}px`, fontWeight: 'bold',
                        textAlign: 'center', border: `1.5px solid ${theme.primary}`, borderRadius: `${4 * s}px`,
                        outline: 'none', background: theme.bg, color: theme.text, padding: 0 }}
                    />
                  </foreignObject>
                ) : (
                  <text
                    x={halfW} y={20 * s} textAnchor="middle" fontSize={14 * s} fontWeight="bold"
                    fill={theme.text} className="select-none"
                    style={editable ? { cursor: 'pointer' } : undefined}
                    onClick={() => startEdit(item.id, item.label)}
                  >{item.label}</text>
                )}
                <text x={halfW} y={38 * s} textAnchor="middle" fontSize={11 * s} fill={theme.muted} className="select-none">
                  {fmt(parseDate(item.date))}
                </text>
                {onItemDelete && (
                  <g
                    transform={`translate(${boxW - 6 * s}, ${-6 * s})`}
                    style={{ cursor: 'pointer' }} className="delete-btn"
                    onClick={(e) => { e.stopPropagation(); onItemDelete(item.id); }}
                  >
                    <circle r={8 * s} fill="#ef4444" opacity="0.85" />
                    <line x1={-3 * s} y1={-3 * s} x2={3 * s} y2={3 * s} stroke="white" strokeWidth={1.5 * s} strokeLinecap="round" />
                    <line x1={3 * s} y1={-3 * s} x2={-3 * s} y2={3 * s} stroke="white" strokeWidth={1.5 * s} strokeLinecap="round" />
                  </g>
                )}
              </g>
            </g>
          );
        })}

        {/* Notes */}
        {sortedItems.filter(i => i.type === 'note').map((item: any) => {
          const layout = layoutMap.get(item.id)!;
          const markerX = layout.rawX;
          const labelX = layout.cx;
          const isTop = layout.side === -1;
          const yExtra = layout.yExtra;
          const isEditing = editingId === item.id;
          const noteY = isTop ? y - (70 * s + yExtra) : y + (70 * s + yExtra);
          const d = 5 * s;

          return (
            <g key={item.id}>
              <line x1={markerX} y1={y} x2={markerX} y2={noteY}
                stroke={theme.muted} strokeWidth={1 * s}
                strokeDasharray={`${3 * s},${3 * s}`} opacity="0.6" />
              <polygon
                points={`${markerX},${y - d} ${markerX + d},${y} ${markerX},${y + d} ${markerX - d},${y}`}
                fill={theme.muted} opacity="0.7" />
              <g className="annotation">
                {isEditing ? (
                  <foreignObject x={labelX - 70 * s} y={noteY - 10 * s} width={140 * s} height={20 * s}>
                    <input
                      ref={inputRef} value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      style={{ width: '100%', height: '100%', fontSize: `${12 * s}px`, fontStyle: 'italic',
                        textAlign: 'center', border: `1.5px solid ${theme.primary}`, borderRadius: `${4 * s}px`,
                        outline: 'none', background: theme.bg, color: theme.muted, padding: 0 }}
                    />
                  </foreignObject>
                ) : (
                  <text
                    x={labelX} y={noteY + (isTop ? -4 * s : 14 * s)}
                    textAnchor="middle" fontSize={12 * s} fontStyle="italic" fill={theme.muted}
                    className="select-none" style={editable ? { cursor: 'pointer' } : undefined}
                    onClick={() => startEdit(item.id, item.label)}
                  >{item.label}</text>
                )}
                <text
                  x={labelX} y={noteY + (isTop ? -18 * s : 28 * s)}
                  textAnchor="middle" fontSize={9 * s} fill={theme.muted} opacity="0.6" className="select-none"
                >{fmt(parseDate(item.date))}</text>
                {onItemDelete && (
                  <g
                    transform={`translate(${labelX + estimateTextWidth(item.label, 12 * s) / 2 + 10 * s}, ${noteY + (isTop ? -4 * s : 14 * s) - 4 * s})`}
                    style={{ cursor: 'pointer' }} className="delete-btn"
                    onClick={() => onItemDelete(item.id)}
                  >
                    <circle r={7 * s} fill="#ef4444" opacity="0.85" />
                    <line x1={-2.5 * s} y1={-2.5 * s} x2={2.5 * s} y2={2.5 * s} stroke="white" strokeWidth={1.5 * s} strokeLinecap="round" />
                    <line x1={2.5 * s} y1={-2.5 * s} x2={-2.5 * s} y2={2.5 * s} stroke="white" strokeWidth={1.5 * s} strokeLinecap="round" />
                  </g>
                )}
              </g>
            </g>
          );
        })}

        {/* Compact date context label */}
        {dateLabel && (
          <text
            x={sliceIndex * canvasWidth + 20} y={30 * s}
            textAnchor="start" fontSize={14 * s} fontWeight="600" fill={theme.muted} opacity="0.6"
          >{dateLabel}</text>
        )}

        {/* Branding */}
        <text
          x={sliceIndex * canvasWidth + canvasWidth - 20} y={canvasHeight - 20}
          textAnchor="end" fontSize={10 * s} fill={theme.muted} opacity="0.5" className="italic"
        >Made with Duckline</text>
      </svg>
    </div>
  );
};

export default TimelinePreview;
