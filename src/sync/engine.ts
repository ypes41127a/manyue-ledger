// 同步流程：第一次連結、之後每次同步、刪除雲端資料。
// 透過參數取得儲存層與雲端硬碟，方便用測試模擬兩台裝置。
import { summarize } from '../core/backup';
import type { BackupSummary } from '../core/backup';
import { firstLinkAction, fromCloud, mergeSync, stampAll, toCloud, withDeviceSettings } from '../core/sync';
import type { Conflict, Stamps } from '../core/sync';
import type { AppData } from '../core/types';
import type { SyncMeta } from '../db/db';
import type { DriveApi } from './drive';

export const MAIN_FILE = 'manyue-ledger.json';
export const BACKUP_PREFIX = 'manyue-ledger-backup-';
const CLOUD_BACKUP_KEEP = 3;

export interface EngineDeps {
  drive: DriveApi;
  getState: () => { data: AppData; meta: SyncMeta };
  apply: (data: AppData | null, meta: Partial<SyncMeta>) => void;
  /** 同步改動這台資料前先留快照 */
  snapshot: (data: AppData) => Promise<void>;
  now?: () => Date;
}

interface CloudState {
  id: string;
  data: AppData;
  stamps: Stamps;
  savedAt: string;
}

async function readMain(drive: DriveApi): Promise<CloudState | null> {
  const f = (await drive.list(MAIN_FILE)).find((x) => x.name === MAIN_FILE);
  if (!f) return null;
  return { id: f.id, ...fromCloud(await drive.read(f.id)) };
}

async function writeMain(drive: DriveApi, id: string | null, data: AppData, stamps: Stamps, deviceId: string, now: Date): Promise<string> {
  const text = JSON.stringify(toCloud(data, stamps, deviceId, now));
  if (id) {
    await drive.update(id, text);
    return id;
  }
  return drive.create(MAIN_FILE, text);
}

/** 覆蓋雲端前先在雲端留一份備份，只保留最近幾份 */
async function backupCloud(drive: DriveApi, cloud: CloudState, now: Date): Promise<void> {
  await drive.create(`${BACKUP_PREFIX}${now.toISOString()}.json`, JSON.stringify(toCloud(cloud.data, cloud.stamps, 'backup', now)));
  const all = (await drive.list(BACKUP_PREFIX)).sort((a, b) => a.name.localeCompare(b.name));
  for (const f of all.slice(0, Math.max(0, all.length - CLOUD_BACKUP_KEEP))) await drive.remove(f.id);
}

export type LinkResult =
  | { kind: 'linked'; how: 'upload' | 'download' }
  | { kind: 'choose'; local: BackupSummary; cloud: BackupSummary; cloudState: CloudState }
  | { kind: 'no-cloud' };

/**
 * 第一次在這台裝置連結雲端。
 * @param restoreOnly 從歡迎頁「取回資料」進來：雲端沒有資料時不建立連結
 */
export async function linkDevice(deps: EngineDeps, email: string, restoreOnly = false): Promise<LinkResult> {
  const now = deps.now?.() ?? new Date();
  const { data, meta } = deps.getState();
  const cloud = await readMain(deps.drive);
  if (!cloud && restoreOnly) return { kind: 'no-cloud' };
  const action = firstLinkAction(data, !!cloud);
  const linked = { linked: true, email, lastSyncAt: now.toISOString(), dirty: false };

  if (action === 'upload') {
    const stamps = stampAll(data, meta.deviceId, now.getTime());
    await writeMain(deps.drive, null, data, stamps, meta.deviceId, now);
    deps.apply(null, { ...linked, stamps, synced: stamps });
    return { kind: 'linked', how: 'upload' };
  }
  if (action === 'download') {
    useCloud(deps, cloud!, email, now);
    return { kind: 'linked', how: 'download' };
  }
  return {
    kind: 'choose',
    local: summarize(data, now.toISOString(), data.schemaVersion),
    cloud: summarize(cloud!.data, cloud!.savedAt, cloud!.data.schemaVersion),
    cloudState: cloud!,
  };
}

function useCloud(deps: EngineDeps, cloud: CloudState, email: string, now: Date): void {
  const { data } = deps.getState();
  if (data.settings.onboarded && !data.settings.isSample) void deps.snapshot(data);
  deps.apply(withDeviceSettings(cloud.data, data.settings), {
    linked: true,
    email,
    stamps: cloud.stamps,
    synced: cloud.stamps,
    lastSyncAt: now.toISOString(),
    dirty: false,
  });
}

/** 兩邊都有資料時，使用者選擇以哪一份為準；被取代的那份會先備份 */
export async function resolveChoice(deps: EngineDeps, email: string, use: 'cloud' | 'local', cloud: CloudState): Promise<void> {
  const now = deps.now?.() ?? new Date();
  if (use === 'cloud') return useCloud(deps, cloud, email, now);
  const { data, meta } = deps.getState();
  await backupCloud(deps.drive, cloud, now);
  const stamps = stampAll(data, meta.deviceId, now.getTime());
  await writeMain(deps.drive, cloud.id, data, stamps, meta.deviceId, now);
  deps.apply(null, { linked: true, email, stamps, synced: stamps, lastSyncAt: now.toISOString(), dirty: false });
}

export interface SyncResult {
  conflicts: Conflict[];
  /** 這台的資料被雲端更新了 */
  pulled: boolean;
  pushed: boolean;
}

/** 和雲端同步一次。同步途中使用者若有修改，會重新再合併一次，不會蓋掉剛輸入的內容 */
export async function syncOnce(deps: EngineDeps, attempts = 3): Promise<SyncResult> {
  for (let i = 0; i < attempts; i++) {
    const now = deps.now?.() ?? new Date();
    const start = deps.getState();
    const cloud = await readMain(deps.drive);

    if (!cloud) {
      // 雲端檔案不見了（例如在另一台按了刪除後又登入）：用這台的資料重建
      const stamps = Object.keys(start.meta.stamps).length ? start.meta.stamps : stampAll(start.data, start.meta.deviceId, now.getTime());
      await writeMain(deps.drive, null, start.data, stamps, start.meta.deviceId, now);
      if (deps.getState().data !== start.data) continue;
      deps.apply(null, { stamps, synced: stamps, lastSyncAt: now.toISOString(), dirty: false });
      return { conflicts: [], pulled: false, pushed: true };
    }

    const r = mergeSync({ data: start.data, stamps: start.meta.stamps }, { data: cloud.data, stamps: cloud.stamps }, start.meta.synced);
    if (deps.getState().data !== start.data) continue;
    if (r.localChanged) {
      await deps.snapshot(start.data);
      if (deps.getState().data !== start.data) continue;
      deps.apply(r.data, { stamps: r.stamps, dirty: r.cloudChanged });
    }
    const expected = deps.getState().data;
    if (r.cloudChanged) await writeMain(deps.drive, cloud.id, r.data, r.stamps, start.meta.deviceId, now);
    // 上傳途中又有修改的話保持「尚未同步」，下一輪會再上傳
    deps.apply(null, { synced: r.stamps, lastSyncAt: now.toISOString(), dirty: deps.getState().data !== expected });
    return { conflicts: r.conflicts, pulled: r.localChanged, pushed: r.cloudChanged };
  }
  throw new Error('資料一直在變動，稍後再同步');
}

/** 刪除雲端上的所有資料（主檔與備份） */
export async function deleteCloudData(drive: DriveApi): Promise<void> {
  for (const f of [...(await drive.list(MAIN_FILE)), ...(await drive.list(BACKUP_PREFIX))]) await drive.remove(f.id);
}
