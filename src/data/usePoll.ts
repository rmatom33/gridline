import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** When `data` was last loaded successfully (ms). */
  updatedAt: number | null;
  /** True when the last refresh failed but older data is still shown. */
  stale: boolean;
  refresh: () => void;
}

/**
 * Loads `fn` and re-runs it every `intervalMs` while the tab is visible.
 * `intervalMs` can be a function of the latest data (poll fast during live games).
 * Pass 0 to load once. Polling pauses in background tabs to save data and API calls.
 */
export function usePoll<T>(fn: () => Promise<T>, intervalMs: number | ((d: T | null) => number), deps: unknown[]): PollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const dataRef = useRef<T | null>(null);
  const intervalRef = useRef(intervalMs);
  intervalRef.current = intervalMs;

  const run = useCallback(async () => {
    try {
      const d = await fnRef.current();
      dataRef.current = d;
      setData(d);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setData(null);
    dataRef.current = null;
    let timer: number | undefined;
    let alive = true;
    const every = () => {
      const i = intervalRef.current;
      return typeof i === 'function' ? i(dataRef.current) : i;
    };
    const schedule = () => {
      const ms = every();
      if (!alive || !ms) return;
      timer = window.setTimeout(async () => {
        if (document.visibilityState === 'visible' && navigator.onLine !== false) await run();
        schedule();
      }, ms);
    };
    run().then(schedule);
    const wake = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, updatedAt, stale: !!error && data != null, refresh: run };
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** Re-renders every `ms` so countdowns and "3 min ago" labels stay current. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/** Fetch once and share across pages (standings change rarely). */
const once = new Map<string, { at: number; p: Promise<unknown> }>();
export function cached<T>(key: string, fn: () => Promise<T>, ttlMs = 5 * 60_000): Promise<T> {
  const hit = once.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.p as Promise<T>;
  const p = fn().catch((e) => { once.delete(key); throw e; });
  once.set(key, { at: Date.now(), p });
  return p;
}
