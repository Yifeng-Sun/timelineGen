
export type TimelineEvent = {
  id: string;
  label: string;
  date: string; // ISO or human readable
  type: 'event';
};

export type TimelinePeriod = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  type: 'period';
};

export type TimelineNote = {
  id: string;
  label: string;
  date: string;
  type: 'note';
};

export type TimelineItem = TimelineEvent | TimelinePeriod | TimelineNote;

export interface AspectRatio {
  label: string;
  width: number;
  height: number;
}

export const ASPECT_RATIOS: AspectRatio[] = [
  { label: '16:9', width: 16, height: 9 },
  { label: '3:2', width: 3, height: 2 },
  { label: '4:3', width: 4, height: 3 },
  { label: '1:1', width: 1, height: 1 },
  { label: '4:5', width: 4, height: 5 },
  { label: '9:16', width: 9, height: 16 },
];

export type Theme = {
  name: string;
  bg: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
};

export const THEMES: Record<string, Theme> = {
  modern: {
    name: 'Modern Clean',
    bg: '#ffffff',
    primary: '#3b82f6',
    secondary: '#eff6ff',
    accent: '#1e40af',
    text: '#1e293b',
    muted: '#64748b'
  },
  midnight: {
    name: 'Midnight Sky',
    bg: '#0f172a',
    primary: '#38bdf8',
    secondary: '#1e293b',
    accent: '#0ea5e9',
    text: '#f8fafc',
    muted: '#94a3b8'
  },
  rosegold: {
    name: 'Rose Gold',
    bg: '#fff7ed',
    primary: '#fb923c',
    secondary: '#fed7aa',
    accent: '#ea580c',
    text: '#431407',
    muted: '#9a3412'
  },
  emerald: {
    name: 'Emerald Forest',
    bg: '#f0fdf4',
    primary: '#10b981',
    secondary: '#a7f3d0',
    accent: '#047857',
    text: '#064e3b',
    muted: '#065f46'
  }
};
