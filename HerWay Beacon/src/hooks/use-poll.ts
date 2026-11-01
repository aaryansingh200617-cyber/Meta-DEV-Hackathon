'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Fetches immediately and then every `ms` (pauses while the tab is hidden). Keeps the last good data on error. */
export function usePoll<T>(fetcher: () => Promise<T>, ms: number | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const alive = useRef(true);
  const initialDone = useRef(false); // Track if initial fetch has happened

  const refresh = useCallback(async () => {
    try {
      const v = await fetchRef.current();
      if (alive.current) { setData(v); setError(null); }
    } catch (e) {
      if (alive.current) setError(e as Error);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    // Only set loading=true on the first mount, not on re-polls — avoids UI flicker
    if (!initialDone.current) {
      setLoading(true);
      initialDone.current = true;
    }
    void refresh();
    if (!ms) return () => { alive.current = false; };
    const id = setInterval(() => { if (!document.hidden) void refresh(); }, ms);
    const vis = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', vis);
    return () => { alive.current = false; clearInterval(id); document.removeEventListener('visibilitychange', vis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, refresh, ...deps]);

  return { data, error, loading, refresh, setData };
}

/** A ticking clock for countdowns (1 s). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}
