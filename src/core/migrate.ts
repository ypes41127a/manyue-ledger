import { defaultSettings, emptyMonth } from './defaults';
import { CURRENT_SCHEMA } from './types';
import type { AppData, YearBook } from './types';

type Migration = (data: any) => any;

/**
 * 逐版升級步驟：migrations[n] 把第 n 版資料升成第 n+1 版。
 * 之後改資料格式時：1) CURRENT_SCHEMA + 1  2) 在這裡加一筆  3) 在 tests/migrate.test.ts 加測試。
 * 已發布的步驟不可修改或刪除，使用者的舊資料與舊備份檔都靠它升級。
 */
export const MIGRATIONS: Record<number, Migration> = {
  // v2：每月新增 notes（項目備註）
  1: (d) => {
    for (const y of Object.values<any>(d.years ?? {})) for (const m of y.months ?? []) if (m) m.notes ??= {};
    return d;
  },
};

export class NewerVersionError extends Error {
  constructor(public found: number) {
    super(`資料版本（${found}）比這個網頁支援的版本（${CURRENT_SCHEMA}）新，請先重新整理網頁更新到最新版再試一次。`);
  }
}

export function migrate(raw: unknown, migrations = MIGRATIONS, target = CURRENT_SCHEMA): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('資料格式不正確');
  let data: any = structuredClone(raw);
  let v = typeof data.schemaVersion === 'number' ? data.schemaVersion : 1;
  if (v > target) throw new NewerVersionError(v);
  while (v < target) {
    const step = migrations[v];
    if (!step) throw new Error(`找不到第 ${v} 版的升級步驟`);
    data = step(data);
    v += 1;
    data.schemaVersion = v;
  }
  return normalize(data);
}

/** 補齊缺漏欄位，避免舊資料或手動修改過的備份檔讓畫面出錯 */
function normalize(data: any): AppData {
  if (!data.years || typeof data.years !== 'object') throw new Error('資料格式不正確：缺少年度資料');
  data.settings = { ...defaultSettings(), ...(data.settings ?? {}) };
  for (const key of Object.keys(data.years)) {
    const b = data.years[key] as YearBook;
    b.year = Number(b.year ?? key);
    b.items ??= [];
    b.holdings ??= [];
    b.currencies ??= [];
    b.baseRates ??= {};
    const months = Array.isArray(b.months) ? b.months : [];
    b.months = Array.from({ length: 12 }, (_, m) => {
      const e = { ...emptyMonth(), ...(months[m] ?? {}) };
      e.notes = { ...(e.notes ?? {}) };
      e.stock = { TW: { ...(e.stock?.TW ?? {}) }, US: { ...(e.stock?.US ?? {}) } };
      return e;
    });
  }
  return data as AppData;
}
