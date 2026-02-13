
import React, { useMemo, useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { TimelineItem, Theme } from '../types';
import { parseDate, formatDate, getMinMaxDates } from '../utils/dateUtils';

const MIN_PERIOD_WIDTH = 60;
const GAP_COMPRESS_RATIO = 3; // gaps > 3x median get compressed

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
  onItemUpdate?: (id: string, changes: Partial<{ label: string }>) => void;
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
  onItemUpdate,
}) => {
  const s = contentScale;
  const { min, max } = useMemo(() => getMinMaxDates(items), [items]);
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

  // Snap x so the item doesn't straddle a slide boundary
  const snapToSlide = (x: number, halfWidth: number): number => {
    if (!avoidSplit || !exportMode || totalSlices <= 1) return x;
    for (let i = 1; i < totalSlices; i++) {
      const boundary = i * canvasWidth;
      const left = x - halfWidth;
      const right = x + halfWidth;
      if (left < boundary && right > boundary) {
        // Push to the side with more room
        return (boundary - left < right - boundary)
          ? boundary - halfWidth - 4
          : boundary + halfWidth + 4;
      }
    }
    return x;
  };

  const getItemDate = (item: TimelineItem): Date => {
    if (item.type === 'event' || item.type === 'note') return parseDate(item.date);
    return parseDate(item.startDate);
  };

  const sortedItems = [...items].sort((a, b) =>
    getItemDate(a).getTime() - getItemDate(b).getTime()
  );

  const editable = !!onItemUpdate;
  const y = actualHeight / 2;

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
        {sortedItems.filter(i => i.type === 'period').map((item: any, idx) => {
          let x1 = xScale(parseDate(item.startDate));
          let x2raw = xScale(parseDate(item.endDate));
          const spanWidth = Math.max(x2raw - x1, MIN_PERIOD_WIDTH * s);
          let x2 = x1 + spanWidth;

          // Snap: use the center of the period for boundary check
          const mid = (x1 + x2) / 2;
          const halfW = Math.max(spanWidth / 2, 80 * s);
          const snapped = snapToSlide(mid, halfW);
          const shift = snapped - mid;
          x1 += shift;
          x2 += shift;

          const height = 60 * s;
          const isEditing = editingId === item.id;
          return (
            <g key={item.id}>
              <rect
                x={x1} y={y - height / 2} width={x2 - x1} height={height}
                fill={theme.secondary} rx={30 * s} opacity="0.6"
              />
              {isEditing ? (
                <foreignObject
                  x={(x1 + x2) / 2 - 75 * s}
                  y={y + (idx % 2 === 0 ? 55 * s : -45 * s) - 14 * s}
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
                  x={(x1 + x2) / 2} y={y + (idx % 2 === 0 ? 55 * s : -45 * s)}
                  textAnchor="middle" fontSize={14 * s} fontWeight="600" fill={theme.accent}
                  className="select-none" style={editable ? { cursor: 'pointer' } : undefined}
                  onClick={() => startEdit(item.id, item.label)}
                >{item.label}</text>
              )}
              <text
                x={(x1 + x2) / 2} y={y + (idx % 2 === 0 ? 75 * s : -65 * s)}
                textAnchor="middle" fontSize={11 * s} fill={theme.muted} className="select-none"
              >
                {formatDate(parseDate(item.startDate))} - {formatDate(parseDate(item.endDate))}
              </text>
            </g>
          );
        })}

        {/* Events */}
        {sortedItems.filter(i => i.type === 'event').map((item: any, idx) => {
          const rawX = xScale(parseDate(item.date));
          const x = snapToSlide(rawX, 75 * s);
          const isTop = idx % 2 === 0;
          const isEditing = editingId === item.id;

          return (
            <g key={item.id}>
              <line x1={x} y1={y} x2={x} y2={isTop ? y - 100 * s : y + 100 * s}
                stroke={theme.primary} strokeWidth={1.5 * s} opacity="0.5" />
              <circle cx={x} cy={y} r={8 * s} fill={theme.bg} stroke={theme.primary} strokeWidth={3 * s} />
              <g transform={`translate(${x - 75 * s}, ${isTop ? y - 160 * s : y + 110 * s})`}>
                <rect
                  width={150 * s} height={50 * s} rx={12 * s} fill={theme.bg}
                  stroke={editable ? theme.primary : theme.secondary} strokeWidth={1 * s}
                  opacity={editable ? 0.8 : 1} style={editable ? { cursor: 'pointer' } : undefined}
                  onClick={() => startEdit(item.id, item.label)}
                />
                {isEditing ? (
                  <foreignObject x={4 * s} y={4 * s} width={142 * s} height={22 * s}>
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
                    x={75 * s} y={20 * s} textAnchor="middle" fontSize={14 * s} fontWeight="bold"
                    fill={theme.text} className="select-none"
                    style={editable ? { cursor: 'pointer' } : undefined}
                    onClick={() => startEdit(item.id, item.label)}
                  >{item.label}</text>
                )}
                <text x={75 * s} y={38 * s} textAnchor="middle" fontSize={11 * s} fill={theme.muted} className="select-none">
                  {formatDate(parseDate(item.date))}
                </text>
              </g>
            </g>
          );
        })}

        {/* Notes */}
        {sortedItems.filter(i => i.type === 'note').map((item: any, idx) => {
          const rawX = xScale(parseDate(item.date));
          const x = snapToSlide(rawX, 70 * s);
          const isTop = idx % 2 === 0;
          const isEditing = editingId === item.id;
          const noteY = isTop ? y - 70 * s : y + 70 * s;
          const d = 5 * s;

          return (
            <g key={item.id}>
              <line x1={x} y1={y} x2={x} y2={noteY}
                stroke={theme.muted} strokeWidth={1 * s}
                strokeDasharray={`${3 * s},${3 * s}`} opacity="0.6" />
              <polygon
                points={`${x},${y - d} ${x + d},${y} ${x},${y + d} ${x - d},${y}`}
                fill={theme.muted} opacity="0.7" />
              {isEditing ? (
                <foreignObject x={x - 70 * s} y={noteY - 10 * s} width={140 * s} height={20 * s}>
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
                  x={x} y={noteY + (isTop ? -4 * s : 14 * s)}
                  textAnchor="middle" fontSize={12 * s} fontStyle="italic" fill={theme.muted}
                  className="select-none" style={editable ? { cursor: 'pointer' } : undefined}
                  onClick={() => startEdit(item.id, item.label)}
                >{item.label}</text>
              )}
              <text
                x={x} y={noteY + (isTop ? -18 * s : 28 * s)}
                textAnchor="middle" fontSize={9 * s} fill={theme.muted} opacity="0.6" className="select-none"
              >{formatDate(parseDate(item.date))}</text>
            </g>
          );
        })}

        {/* Branding */}
        <text
          x={sliceIndex * canvasWidth + canvasWidth - 20} y={canvasHeight - 20}
          textAnchor="end" fontSize={10 * s} fill={theme.muted} opacity="0.5" className="italic"
        >Generated with Chronicle Flow</text>
      </svg>
    </div>
  );
};

export default TimelinePreview;
