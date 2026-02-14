
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { TimelineItem, AspectRatio, ASPECT_RATIOS, Theme, THEMES, FontOption, FONTS } from './types';
import TimelinePreview from './components/TimelinePreview';
import ControlPanel from './components/ControlPanel';
import AddItemPanel from './components/AddItemPanel';
import {
  User,
  TimelineSummary,
  fetchSession,
  fetchTimelines as apiFetchTimelines,
  createTimeline,
  getTimeline,
  updateTimeline,
  deleteTimeline as apiDeleteTimeline,
  getSignInUrl,
  signOut,
  exchangeAuthCode,
  getStoredUser,
  hasToken,
  clearAuth,
  syncAuthFromStorage,
} from './lib/api';

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

  // Auth & cloud timeline state
  const [user, setUser] = useState<User | null>(null);
  const [timelines, setTimelines] = useState<TimelineSummary[]>([]);
  const [currentTimelineId, setCurrentTimelineId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = useState(false);
  const [signInWaiting, setSignInWaiting] = useState(false);

  // Push / Pull dialog state
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [pushTitle, setPushTitle] = useState('');
  const [pushMode, setPushMode] = useState<'create' | 'update'>('create');
  const [pushTargetId, setPushTargetId] = useState<string | null>(null);
  const [showPullDialog, setShowPullDialog] = useState(false);
  const [pullTarget, setPullTarget] = useState<TimelineSummary | null>(null);

  // Handle auth_code callback (popup lands here after OAuth) + restore session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get('auth_code');

    if (authCode) {
      // Clean the URL so the code isn't visible / reusable
      params.delete('auth_code');
      const clean = params.toString();
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (clean ? `?${clean}` : '')
      );

      // Exchange the one-time code for a token
      exchangeAuthCode(authCode).then((result) => {
        if (result?.user) {
          setUser(result.user);
          // If this is the popup window, close it (main window picks up via storage event)
          window.close();
        }
      });
      return;
    }

    // Not a callback — try restoring session from stored token
    const stored = getStoredUser();
    if (stored && hasToken()) {
      setUser(stored);
      // Verify token is still valid in the background
      fetchSession().then((data) => {
        if (data?.user) {
          setUser(data.user);
        } else {
          // Token expired
          clearAuth();
          setUser(null);
        }
      });
    }
  }, []);

  // Listen for auth changes from the popup (via localStorage)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'duckline_token') {
        syncAuthFromStorage();
      }
      if (e.key === 'duckline_user' && e.newValue) {
        try {
          const newUser = JSON.parse(e.newValue) as User;
          setUser(newUser);
          setShowSignInDialog(false);
          setSignInWaiting(false);
        } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Fetch timelines when user signs in
  useEffect(() => {
    if (user) {
      apiFetchTimelines()
        .then((data) => setTimelines(data.timelines))
        .catch(() => {});
    } else {
      setTimelines([]);
      setCurrentTimelineId(null);
    }
  }, [user]);

  const handleSignIn = useCallback(() => {
    setShowSignInDialog(true);
    setSignInWaiting(false);
  }, []);

  const handleSignInContinue = useCallback(() => {
    window.open(getSignInUrl(), '_blank');
    setSignInWaiting(true);
  }, []);

  const handleSignInCancel = useCallback(() => {
    setShowSignInDialog(false);
    setSignInWaiting(false);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setUser(null);
  }, []);

  // Derived: timeline cap based on plan
  const timelineLimit = user?.plan === 'premium' ? 200 : 3;

  // Derived: name of the currently linked timeline
  const currentTimelineName = useMemo(() => {
    if (!currentTimelineId) return null;
    return timelines.find((t) => t.id === currentTimelineId)?.title || null;
  }, [currentTimelineId, timelines]);

  // Open push dialog
  const handleOpenPush = useCallback(() => {
    if (currentTimelineId) {
      // Default to updating the currently linked timeline
      setPushMode('update');
      setPushTargetId(currentTimelineId);
      const existing = timelines.find((t) => t.id === currentTimelineId);
      setPushTitle(existing?.title || '');
    } else {
      setPushMode('create');
      setPushTargetId(null);
      setPushTitle('');
    }
    setShowPushDialog(true);
  }, [currentTimelineId, timelines]);

  // Confirm push
  const handlePushConfirm = useCallback(async () => {
    if (!user) return;
    const title = pushTitle.trim() || 'Untitled';
    setIsSaving(true);
    try {
      if (pushMode === 'update' && pushTargetId) {
        await updateTimeline(pushTargetId, title, items);
        setCurrentTimelineId(pushTargetId);
      } else {
        const { id } = await createTimeline(title, items);
        setCurrentTimelineId(id);
      }
      const { timelines: updated } = await apiFetchTimelines();
      setTimelines(updated);
    } catch {
      // silently fail
    } finally {
      setIsSaving(false);
      setShowPushDialog(false);
    }
  }, [user, pushTitle, pushMode, pushTargetId, items]);

  // Open pull dialog (refresh list first)
  const handleOpenPull = useCallback(async () => {
    setPullTarget(null);
    setShowPullDialog(true);
    try {
      const { timelines: updated } = await apiFetchTimelines();
      setTimelines(updated);
    } catch { /* keep stale list */ }
  }, []);

  // Confirm pull
  const handlePullConfirm = useCallback(async () => {
    if (!pullTarget) return;
    setIsLoading(true);
    try {
      const data = await getTimeline(pullTarget.id);
      setItems(data.items as TimelineItem[]);
      setCurrentTimelineId(pullTarget.id);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
      setShowPullDialog(false);
      setPullTarget(null);
    }
  }, [pullTarget]);

  // Delete a remote timeline from the pull dialog
  const handleDeleteRemote = useCallback(async (id: string) => {
    try {
      await apiDeleteTimeline(id);
      setTimelines((prev) => prev.filter((t) => t.id !== id));
      if (currentTimelineId === id) setCurrentTimelineId(null);
      if (pullTarget?.id === id) setPullTarget(null);
    } catch {
      // silently fail
    }
  }, [currentTimelineId, pullTarget]);

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
    // Don't start drag tracking when interacting with editing inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
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
      // Only capture pointer when we confirm a horizontal drag
      if (dragRef.current.locked) {
        (e.currentTarget as HTMLElement).setPointerCapture(dragRef.current.pointerId);
      }
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

  // Scroll zoom on preview area (non-passive to allow preventDefault)
  useEffect(() => {
    const el = previewAreaRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(prev => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        return Math.round(Math.min(3.0, Math.max(0.5, prev + delta)) * 10) / 10;
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
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
        user={user}
        currentTimelineName={currentTimelineName}
        remoteCount={timelines.length}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onPush={handleOpenPush}
        onPull={handleOpenPull}
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {showCarouselPreview && !isDragging && (
            <>
              <button
                onClick={() => setCurrentSlide((s: number) => Math.max(0, s - 1))}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={currentSlide === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 transition disabled:opacity-0 disabled:pointer-events-none"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button
                onClick={() => setCurrentSlide((s: number) => Math.min(exportSlices - 1, s + 1))}
                onPointerDown={(e) => e.stopPropagation()}
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

      {/* Sign-in dialog */}
      {showSignInDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5">
            {!signInWaiting ? (
              <>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg">Sign in to Duckline</h3>
                  <p className="text-sm text-slate-500">Save and sync your timelines across devices</p>
                </div>
                <button
                  onClick={handleSignInContinue}
                  className="w-full py-3 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition flex items-center justify-center gap-2"
                >
                  Continue with Google or GitHub
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
                <p className="text-[11px] text-slate-400 text-center">Opens sign-in in a new tab</p>
                <button
                  onClick={handleSignInCancel}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                    <span className="inline-block w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg">Waiting for sign-in</h3>
                  <p className="text-sm text-slate-500">Complete the sign-in in the tab that just opened, then come back here.</p>
                </div>
                <button
                  onClick={handleSignInContinue}
                  className="w-full py-2.5 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                >
                  Re-open sign-in tab
                </button>
                <button
                  onClick={handleSignInCancel}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Push to Remote Pond dialog */}
      {showPushDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <h3 className="font-bold text-slate-900 text-lg">Push to Remote Pond</h3>
                <div className="relative group/tip">
                  <div className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center cursor-help">i</div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-0 w-52 bg-slate-800 text-white text-[11px] leading-relaxed rounded-lg p-2.5 pb-4 opacity-0 pointer-events-none group-hover/tip:opacity-100 group-hover/tip:pointer-events-auto transition-opacity duration-300 z-10">
                    Each account can save up to {timelineLimit} remote timelines. <a href="mailto:ys@yifengsun.com?subject=Duckline%20Upgrade%20Request" className="underline text-blue-300 hover:text-blue-200">Need more?</a>.
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                {pushMode === 'update' ? 'Update your remote timeline' : 'Save your timeline to the cloud'}
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Items</span>
                <span className="font-medium text-slate-800">{items.length} ducks</span>
              </div>
              <div className="space-y-1.5">
                <span className="text-slate-500">Action</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPushMode('create');
                      setPushTargetId(null);
                      setPushTitle('');
                    }}
                    disabled={timelines.length >= timelineLimit}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                      pushMode === 'create'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : timelines.length >= timelineLimit
                          ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Create new
                  </button>
                  <button
                    onClick={() => {
                      setPushMode('update');
                      const target = currentTimelineId || timelines[0]?.id || null;
                      setPushTargetId(target);
                      const existing = timelines.find((t) => t.id === target);
                      setPushTitle(existing?.title || '');
                    }}
                    disabled={timelines.length === 0}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                      pushMode === 'update'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : timelines.length === 0
                          ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Update existing
                  </button>
                </div>
                {timelines.length >= timelineLimit && pushMode !== 'update' && (
                  <p className="text-xs text-amber-600">Max {timelineLimit} remote timelines reached. Delete one or update an existing one.</p>
                )}
              </div>
            </div>

            {pushMode === 'update' && timelines.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Select timeline to update</label>
                <select
                  value={pushTargetId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPushTargetId(id);
                    const existing = timelines.find((t) => t.id === id);
                    setPushTitle(existing?.title || '');
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {timelines.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}{t.id === currentTimelineId ? ' (linked)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Timeline name</label>
              <input
                type="text"
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="Untitled"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowPushDialog(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handlePushConfirm}
                disabled={isSaving || (pushMode === 'create' && timelines.length >= timelineLimit) || (pushMode === 'update' && !pushTargetId)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Confirm Push'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pull from Remote Pond dialog */}
      {showPullDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
            {!pullTarget ? (
              <>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><polyline points="9 15 12 18 15 15"/></svg>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg">Pull from Remote Pond</h3>
                  <p className="text-sm text-slate-500">Select a timeline to load</p>
                </div>

                {timelines.length > 0 ? (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                    {timelines.map((t) => {
                      const ago = (() => {
                        const s = Math.floor((Date.now() - t.updatedAt) / 1000);
                        if (s < 60) return 'just now';
                        const m = Math.floor(s / 60);
                        if (m < 60) return `${m}m ago`;
                        const h = Math.floor(m / 60);
                        if (h < 24) return `${h}h ago`;
                        return `${Math.floor(h / 24)}d ago`;
                      })();
                      return (
                        <div
                          key={t.id}
                          className={`group flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                            currentTimelineId === t.id
                              ? 'border-blue-400 bg-blue-50'
                              : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                          }`}
                          onClick={() => setPullTarget(t)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                            <p className="text-[10px] text-slate-400">{ago}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRemote(t.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 transition"
                            title="Delete timeline"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                          </button>
                          <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-slate-400">No remote timelines yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Push your first timeline to get started.</p>
                  </div>
                )}

                <button
                  onClick={() => setShowPullDialog(false)}
                  className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg">Confirm Pull</h3>
                </div>

                <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Remote timeline</span>
                    <span className="font-medium text-slate-800">{pullTarget.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last updated</span>
                    <span className="font-medium text-slate-800">
                      {new Date(pullTarget.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <hr className="border-slate-200" />
                  <div className="flex justify-between">
                    <span className="text-slate-500">Local items to replace</span>
                    <span className="font-medium text-red-600">{items.length} ducks</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 text-center leading-relaxed">
                  This will <span className="font-semibold text-red-600">replace</span> your current {items.length} local items with the remote timeline &ldquo;{pullTarget.title}&rdquo;.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPullTarget(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                  >
                    Back
                  </button>
                  <button
                    onClick={handlePullConfirm}
                    disabled={isLoading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Confirm Pull'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
