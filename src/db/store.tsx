import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData, YearBook } from '../core/types';
import { loadApp, saveApp } from './db';

interface Store {
  data: AppData;
  year: number;
  book: YearBook;
  years: number[];
  setYear: (y: number) => void;
  /** 直接修改 draft 即可，修改後自動存入 IndexedDB */
  update: (fn: (draft: AppData) => void) => void;
  replace: (data: AppData) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

function pickYear(data: AppData, preferred: number): number {
  const ys = Object.keys(data.years).map(Number);
  return ys.includes(preferred) ? preferred : Math.max(...ys);
}

export function StoreProvider({ children, fallback }: { children: ReactNode; fallback: (error: string | null) => ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const pending = useRef<AppData | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    loadApp().then(
      (d) => {
        setData(d);
        setYear((y) => pickYear(d, y));
      },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    );
    // 申請永久儲存，降低瀏覽器自動清除資料的機率
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const d = pending.current;
    pending.current = null;
    if (d) saveApp(d).catch((e) => setError('儲存失敗：' + (e instanceof Error ? e.message : String(e))));
  }, []);

  useEffect(() => {
    const onHide = () => flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flush]);

  const commit = useCallback(
    (next: AppData) => {
      pending.current = next;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 250);
    },
    [flush],
  );

  const update = useCallback(
    (fn: (draft: AppData) => void) => {
      setData((cur) => {
        if (!cur) return cur;
        const draft = structuredClone(cur);
        fn(draft);
        commit(draft);
        return draft;
      });
    },
    [commit],
  );

  const replace = useCallback(
    (next: AppData) => {
      setData(next);
      setYear((y) => pickYear(next, y));
      commit(next);
      flush();
    },
    [commit, flush],
  );

  const value = useMemo<Store | null>(() => {
    if (!data) return null;
    const y = pickYear(data, year);
    return {
      data,
      year: y,
      book: data.years[y],
      years: Object.keys(data.years).map(Number).sort((a, b) => a - b),
      setYear,
      update,
      replace,
    };
  }, [data, year, update, replace]);

  if (!value) return <>{fallback(error)}</>;
  return (
    <Ctx.Provider value={value}>
      {error && <div className="bg-danger px-4 py-2 text-sm text-white">{error}</div>}
      {children}
    </Ctx.Provider>
  );
}
