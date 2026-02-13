
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

export type TimelineItem = TimelineEvent | TimelinePeriod;

export type Orientation = 'landscape' | 'portrait';

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
    secondary: '#ffedd5',
    accent: '#ea580c',
    text: '#431407',
    muted: '#9a3412'
  },
  emerald: {
    name: 'Emerald Forest',
    bg: '#f0fdf4',
    primary: '#10b981',
    secondary: '#dcfce7',
    accent: '#047857',
    text: '#064e3b',
    muted: '#065f46'
  }
};
