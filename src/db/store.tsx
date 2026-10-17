import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppData, YearBook } from '../core/types';
import { loadApp, loadMeta, saveAll } from './db';
import type { SyncMeta } from './db';
import { withStamps } from './state';
import type { State } from './state';

interface Store {
  data: AppData;
  meta: SyncMeta;
  year: number;
  book: YearBook;
  years: number[];
  setYear: (y: number) => void;
  /** 直接修改 draft 即可，修改後自動存入 IndexedDB，並記錄哪些部分被改過 */
  update: (fn: (draft: AppData) => void) => void;
  /** 整份取代（匯入備份、還原快照、清除資料）；變動的部分視為使用者修改 */
  replace: (data: AppData) => void;
  /** 同步用：套用合併後的資料與同步資訊，不另外標記修改 */
  applySync: (data: AppData | null, meta: Partial<SyncMeta>) => void;
  /** 立即取得最新狀態（不等畫面更新） */
  getLatest: () => State;
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
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const pending = useRef<State | null>(null);
  const latest = useRef<State | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    Promise.all([loadApp(), loadMeta()]).then(
      ([data, meta]) => {
        latest.current = { data, meta };
        setState(latest.current);
        setYear((y) => pickYear(data, y));
      },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    );
    // 申請永久儲存，降低瀏覽器自動清除資料的機率
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const s = pending.current;
    pending.current = null;
    if (s) saveAll(s.data, s.meta).catch((e) => setError('儲存失敗：' + (e instanceof Error ? e.message : String(e))));
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
    (next: State) => {
      pending.current = next;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 250);
    },
    [flush],
  );

  const set = useCallback(
    (fn: (cur: State) => State, now = false) => {
      const cur = latest.current;
      if (!cur) return;
      const next = fn(cur);
      latest.current = next;
      setState(next);
      setYear((y) => pickYear(next.data, y));
      commit(next);
      if (now) window.setTimeout(flush, 0);
    },
    [commit, flush],
  );

  const update = useCallback(
    (fn: (draft: AppData) => void) =>
      set((cur) => {
        const draft = structuredClone(cur.data);
        fn(draft);
        return withStamps(cur, draft);
      }),
    [set],
  );

  const replace = useCallback((data: AppData) => set((cur) => withStamps(cur, data), true), [set]);

  const applySync = useCallback(
    (data: AppData | null, meta: Partial<SyncMeta>) => set((cur) => ({ data: data ?? cur.data, meta: { ...cur.meta, ...meta } }), true),
    [set],
  );

  const getLatest = useCallback(() => latest.current!, []);

  const value = useMemo<Store | null>(() => {
    if (!state) return null;
    const { data, meta } = state;
    const y = pickYear(data, year);
    return {
      data,
      meta,
      year: y,
      book: data.years[y],
      years: Object.keys(data.years).map(Number).sort((a, b) => a - b),
      setYear,
      update,
      replace,
      applySync,
      getLatest,
    };
  }, [state, year, update, replace, applySync, getLatest]);

  if (!value) return <>{fallback(error)}</>;
  return (
    <Ctx.Provider value={value}>
      {error && <div className="bg-danger px-4 py-2 text-sm text-white">{error}</div>}
      {children}
    </Ctx.Provider>
  );
}
