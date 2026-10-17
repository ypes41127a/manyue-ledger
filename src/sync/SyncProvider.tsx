import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BackupSummary } from '../core/backup';
import { emptyAppData } from '../core/defaults';
import { NewerVersionError } from '../core/migrate';
import type { Conflict } from '../core/sync';
import { saveSnapshot } from '../db/db';
import { useStore } from '../db/store';
import { syncAvailable } from './config';
import { AuthError, driveFor } from './drive';
import { deleteCloudData, linkDevice, resolveChoice, syncOnce } from './engine';
import type { EngineDeps, LinkResult } from './engine';
import { currentToken, dropToken, fetchEmail, NeedTapError, preloadGoogle, requestToken, revokeToken } from './google';

export type SyncStatus = 'off' | 'needs-auth' | 'syncing' | 'ok' | 'error';

interface Choice {
  local: BackupSummary;
  cloud: BackupSummary;
  resolve: (use: 'cloud' | 'local') => Promise<void>;
}

interface SyncCtx {
  available: boolean;
  status: SyncStatus;
  message: string | null;
  conflicts: Conflict[];
  dismissConflicts: () => void;
  choice: Choice | null;
  cancelChoice: () => void;
  /** 登入並同步。必須在按鈕點擊時呼叫（會開啟 Google 登入小視窗） */
  connect: (opts?: { restoreOnly?: boolean }) => Promise<LinkResult['kind'] | 'error'>;
  signOut: (clearLocal: boolean) => void;
  deleteCloud: () => Promise<boolean>;
}

const Ctx = createContext<SyncCtx | null>(null);

export function useSync(): SyncCtx {
  const s = useContext(Ctx);
  if (!s) throw new Error('SyncProvider missing');
  return s;
}

const AUTO_SYNC_DELAY = 5000;

function describe(e: unknown): string {
  if (e instanceof NewerVersionError) return '雲端資料來自較新版本的網頁，請重新整理網頁更新到最新版後再同步。';
  return e instanceof Error ? e.message : String(e);
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const { meta, getLatest, applySync, replace } = store;
  const [status, setStatus] = useState<SyncStatus>(meta.linked ? 'needs-auth' : 'off');
  const [message, setMessage] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [choice, setChoice] = useState<Choice | null>(null);
  const running = useRef(false);

  const deps = useCallback(
    (token: string): EngineDeps => ({ drive: driveFor(token), getState: getLatest, apply: applySync, snapshot: (d) => saveSnapshot(d) }),
    [getLatest, applySync],
  );

  const fail = useCallback((e: unknown) => {
    if (e instanceof AuthError) {
      dropToken();
      setStatus('needs-auth');
      setMessage(null);
      return;
    }
    setStatus('error');
    setMessage(describe(e));
  }, []);

  /** 已有授權時在背景同步 */
  const runSync = useCallback(async () => {
    const token = currentToken();
    if (!token || running.current || !getLatest().meta.linked) {
      if (!token && getLatest().meta.linked) setStatus('needs-auth');
      return;
    }
    running.current = true;
    setStatus('syncing');
    try {
      const r = await syncOnce(deps(token));
      if (r.conflicts.length) setConflicts(r.conflicts);
      setStatus('ok');
      setMessage(null);
    } catch (e) {
      fail(e);
    } finally {
      running.current = false;
    }
  }, [deps, fail, getLatest]);

  const connect = useCallback(
    async (opts: { restoreOnly?: boolean } = {}) => {
      let token: string;
      try {
        // 必須第一個執行：瀏覽器只允許在點擊當下開啟登入小視窗
        token = currentToken() ?? (await requestToken(getLatest().meta.email));
      } catch (e) {
        if (!(e instanceof NeedTapError)) fail(e);
        else setMessage(e.message);
        return 'error' as const;
      }
      if (getLatest().meta.linked) {
        await runSync();
        return 'linked' as const;
      }
      running.current = true;
      setStatus('syncing');
      try {
        const email = (await fetchEmail(token)) || getLatest().meta.email || '';
        const r = await linkDevice(deps(token), email, opts.restoreOnly);
        if (r.kind === 'choose') {
          setStatus('off');
          setChoice({
            local: r.local,
            cloud: r.cloud,
            resolve: async (use) => {
              setChoice(null);
              setStatus('syncing');
              try {
                await resolveChoice(deps(token), email, use, r.cloudState);
                setStatus('ok');
              } catch (e) {
                fail(e);
              }
            },
          });
        } else if (r.kind === 'no-cloud') {
          setStatus('off');
          setMessage('這個 Google 帳號還沒有雲端資料。請先在原本的裝置登入並同步，或從空白開始設定。');
        } else {
          setStatus('ok');
          setMessage(null);
        }
        return r.kind;
      } catch (e) {
        fail(e);
        return 'error' as const;
      } finally {
        running.current = false;
      }
    },
    [deps, fail, getLatest, runSync],
  );

  const signOut = useCallback(
    (clearLocal: boolean) => {
      revokeToken();
      applySync(null, { linked: false, email: undefined, synced: {}, dirty: false, lastSyncAt: undefined });
      if (clearLocal) replace(emptyAppData(new Date().getFullYear()));
      setStatus('off');
      setMessage(null);
      setConflicts([]);
    },
    [applySync, replace],
  );

  const deleteCloud = useCallback(async () => {
    try {
      const token = currentToken() ?? (await requestToken(getLatest().meta.email));
      await deleteCloudData(driveFor(token));
      signOut(false);
      setMessage('已刪除雲端上的資料，這台裝置的資料保留。');
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }, [fail, getLatest, signOut]);

  // 已連結的裝置：先載入 Google 登入元件，使用者一點就能立即開啟登入視窗
  useEffect(() => {
    if (meta.linked && syncAvailable) void preloadGoogle().catch(() => {});
    if (!meta.linked) setStatus('off');
    else setStatus((s) => (s === 'off' ? (currentToken() ? 'ok' : 'needs-auth') : s));
  }, [meta.linked]);

  // 有修改時，停下來 5 秒後自動同步
  useEffect(() => {
    if (!meta.linked || !meta.dirty) return;
    const t = window.setTimeout(() => void runSync(), AUTO_SYNC_DELAY);
    return () => window.clearTimeout(t);
  }, [meta.linked, meta.dirty, meta.stamps, runSync]);

  // 切回這個網頁時，拉取另一台裝置的修改
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && void runSync();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [runSync]);

  const value = useMemo<SyncCtx>(
    () => ({
      available: syncAvailable,
      status,
      message,
      conflicts,
      dismissConflicts: () => setConflicts([]),
      choice,
      cancelChoice: () => setChoice(null),
      connect,
      signOut,
      deleteCloud,
    }),
    [status, message, conflicts, choice, connect, signOut, deleteCloud],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
