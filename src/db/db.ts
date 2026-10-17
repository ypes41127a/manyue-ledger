import Dexie from 'dexie';
import type { Table } from 'dexie';
import { emptyAppData } from '../core/defaults';
import { migrate } from '../core/migrate';
import { newId } from '../core/safe';
import type { Stamps } from '../core/sync';
import { CURRENT_SCHEMA } from '../core/types';
import type { AppData } from '../core/types';

interface KV {
  key: string;
  value: unknown;
}

// 這裡的 Dexie 版本只管「資料表結構」；資料內容的版本由 AppData.schemaVersion 與 core/migrate.ts 管理
class LedgerDB extends Dexie {
  kv!: Table<KV, string>;
  constructor() {
    super('manyue-ledger');
    this.version(1).stores({ kv: 'key' });
  }
}

const db = new LedgerDB();
const APP_KEY = 'app';

/** 讀取資料；舊版資料會先留一份快照再自動升級 */
export async function loadApp(): Promise<AppData> {
  const row = await db.kv.get(APP_KEY);
  if (!row) return emptyAppData(new Date().getFullYear());
  const raw = row.value as { schemaVersion?: number };
  const from = raw.schemaVersion ?? 1;
  const data = migrate(raw);
  if (from < CURRENT_SCHEMA) {
    await db.kv.put({ key: `snapshot-v${from}`, value: raw });
    await db.kv.put({ key: APP_KEY, value: data });
  }
  return data;
}

// ---- 雲端同步的裝置端資訊 ----

export interface SyncMeta {
  /** 這台裝置的代號（隨機產生，用來標示修改來源） */
  deviceId: string;
  /** 各單位最後修改時間 */
  stamps: Stamps;
  /** 上次同步成功時的修改時間 */
  synced: Stamps;
  linked: boolean;
  email?: string;
  lastSyncAt?: string;
  /** 有修改尚未上傳 */
  dirty: boolean;
}

const META_KEY = 'sync';
const SNAP_PREFIX = 'sync-snap-';
const SNAP_KEEP = 5;

export async function loadMeta(): Promise<SyncMeta> {
  const row = await db.kv.get(META_KEY);
  const m = (row?.value ?? {}) as Partial<SyncMeta>;
  return {
    deviceId: m.deviceId ?? newId('dev'),
    stamps: m.stamps ?? {},
    synced: m.synced ?? {},
    linked: m.linked ?? false,
    email: m.email,
    lastSyncAt: m.lastSyncAt,
    dirty: m.dirty ?? false,
  };
}

/** 資料與修改時間一起寫入，避免只存了一半 */
export async function saveAll(data: AppData, meta: SyncMeta): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    await db.kv.put({ key: APP_KEY, value: data });
    await db.kv.put({ key: META_KEY, value: meta });
  });
}

/** 同步改動這台資料前留一份快照，只保留最近幾份 */
export async function saveSnapshot(data: AppData, now = new Date()): Promise<void> {
  await db.kv.put({ key: `${SNAP_PREFIX}${now.toISOString()}`, value: data });
  const keys = (await db.kv.where('key').startsWith(SNAP_PREFIX).primaryKeys()).sort();
  await db.kv.bulkDelete(keys.slice(0, Math.max(0, keys.length - SNAP_KEEP)));
}

export async function listSnapshots(): Promise<string[]> {
  const keys = await db.kv.where('key').startsWith(SNAP_PREFIX).primaryKeys();
  return keys.map((k) => k.slice(SNAP_PREFIX.length)).sort().reverse();
}

export async function loadSnapshot(at: string): Promise<AppData | null> {
  const row = await db.kv.get(`${SNAP_PREFIX}${at}`);
  return row ? migrate(row.value) : null;
}
