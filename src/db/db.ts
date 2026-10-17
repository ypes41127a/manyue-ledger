import Dexie from 'dexie';
import type { Table } from 'dexie';
import { emptyAppData } from '../core/defaults';
import { migrate } from '../core/migrate';
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

export async function saveApp(data: AppData): Promise<void> {
  await db.kv.put({ key: APP_KEY, value: data });
}
