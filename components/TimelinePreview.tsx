
import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { TimelineItem, Orientation, Theme } from '../types';
import { parseDate, formatDate, getMinMaxDates } from '../utils/dateUtils';

interface TimelinePreviewProps {
  items: TimelineItem[];
  orientation: Orientation;
  theme: Theme;
  exportMode?: boolean;
  sliceIndex?: number;
  totalSlices?: number;
  canvasWidth?: number;
  canvasHeight?: number;
}

const TimelinePreview: React.FC<TimelinePreviewProps> = ({
  items,
  orientation,
  theme,
  exportMode = false,
  sliceIndex = 0,
  totalSlices = 1,
  canvasWidth = 1200,
  canvasHeight = 800
}) => {
  const { min, max } = useMemo(() => getMinMaxDates(items), [items]);

  // Width is multiplied by slices if in export mode to maintain scale
  const actualWidth = exportMode ? canvasWidth * totalSlices : canvasWidth;
  const actualHeight = canvasHeight;

  // d3 Scales
  const xScale = d3.scaleTime()
    .domain([min, max])
    .range([actualWidth * 0.1, actualWidth * 0.9]);

  const sortedItems = [...items].sort((a, b) => {
    const da = a.type === 'event' ? parseDate(a.date) : parseDate(a.startDate);
    const db = b.type === 'event' ? parseDate(b.date) : parseDate(b.startDate);
    return da.getTime() - db.getTime();
  });

  return (
    <div className="relative bg-white shadow-xl rounded-lg overflow-hidden flex items-center justify-center border border-slate-200">
      <svg
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`${sliceIndex * canvasWidth} 0 ${canvasWidth} ${canvasHeight}`}
        className="w-full h-full"
        style={{ backgroundColor: theme.bg }}
      >
        {/* Background Decorative Elements */}
        <defs>
          <linearGradient id="mainLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={theme.primary} stopOpacity="0.2" />
            <stop offset="50%" stopColor={theme.primary} stopOpacity="1" />
            <stop offset="100%" stopColor={theme.primary} stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* The Main Timeline Line */}
        <line
          x1={xScale(min)}
          y1={actualHeight / 2}
          x2={xScale(max)}
          y2={actualHeight / 2}
          stroke={theme.primary}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="8,8"
          opacity="0.3"
        />
        <line
          x1={xScale(min)}
          y1={actualHeight / 2}
          x2={xScale(max)}
          y2={actualHeight / 2}
          stroke="url(#mainLineGradient)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Render Periods First (Lower Layer) */}
        {sortedItems.filter(i => i.type === 'period').map((item: any, idx) => {
          const x1 = xScale(parseDate(item.startDate));
          const x2 = xScale(parseDate(item.endDate));
          const y = actualHeight / 2;
          const height = 60;
          return (
            <g key={item.id}>
              <rect
                x={x1}
                y={y - height / 2}
                width={x2 - x1}
                height={height}
                fill={theme.secondary}
                rx="30"
                opacity="0.6"
              />
              <text
                x={(x1 + x2) / 2}
                y={y + (idx % 2 === 0 ? 55 : -45)}
                textAnchor="middle"
                fontSize="14"
                fontWeight="600"
                fill={theme.accent}
                className="select-none"
              >
                {item.label}
              </text>
              <text
                x={(x1 + x2) / 2}
                y={y + (idx % 2 === 0 ? 75 : -65)}
                textAnchor="middle"
                fontSize="11"
                fill={theme.muted}
                className="select-none"
              >
                {formatDate(parseDate(item.startDate))} - {formatDate(parseDate(item.endDate))}
              </text>
            </g>
          );
        })}

        {/* Render Events (Upper Layer) */}
        {sortedItems.filter(i => i.type === 'event').map((item: any, idx) => {
          const x = xScale(parseDate(item.date));
          const y = actualHeight / 2;
          const isTop = idx % 2 === 0;
          
          return (
            <g key={item.id}>
              {/* Connector */}
              <line
                x1={x}
                y1={y}
                x2={x}
                y2={isTop ? y - 100 : y + 100}
                stroke={theme.primary}
                strokeWidth="1.5"
                opacity="0.5"
              />
              
              {/* Dot */}
              <circle
                cx={x}
                cy={y}
                r="8"
                fill={theme.bg}
                stroke={theme.primary}
                strokeWidth="3"
              />

              {/* Label Box */}
              <g transform={`translate(${x - 75}, ${isTop ? y - 160 : y + 110})`}>
                <rect
                  width="150"
                  height="50"
                  rx="12"
                  fill={theme.bg}
                  stroke={theme.secondary}
                  strokeWidth="1"
                  className="shadow-sm"
                />
                <text
                  x="75"
                  y="20"
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="bold"
                  fill={theme.text}
                  className="select-none"
                >
                  {item.label}
                </text>
                <text
                  x="75"
                  y="38"
                  textAnchor="middle"
                  fontSize="11"
                  fill={theme.muted}
                  className="select-none"
                >
                  {formatDate(parseDate(item.date))}
                </text>
              </g>
            </g>
          );
        })}

        {/* App Branding */}
        <text
          x={sliceIndex * canvasWidth + canvasWidth - 20}
          y={canvasHeight - 20}
          textAnchor="end"
          fontSize="10"
          fill={theme.muted}
          opacity="0.5"
          className="italic"
        >
          Generated with Chronicle Flow
        </text>
      </svg>
    </div>
  );
};

export default TimelinePreview;
