// 雲端同步的純邏輯：把資料拆成小單位、記錄修改時間、合併兩邊。
// 不碰網路與 IndexedDB，方便單元測試。
import { defaultSettings, emptyMonth } from './defaults';
import { migrate } from './migrate';
import { APP_ID } from './types';
import type { AppData, MonthEntry, Settings, YearBook } from './types';

/** 'settings'、'2026/config'（項目、持股、幣別）、'2026/9'（10 月） */
export type UnitKey = string;

export interface Stamp {
  /** 修改時間（毫秒） */
  t: number;
  /** 修改的裝置 */
  d: string;
}
export type Stamps = Record<UnitKey, Stamp>;

/** 跟著帳號同步的設定；其餘（密碼鎖、上次備份日期、範例模式）只屬於這台裝置 */
const SHARED_SETTINGS = ['fillDay', 'liabilitiesEnabled'] as const satisfies readonly (keyof Settings)[];

type YearConfig = Pick<YearBook, 'items' | 'holdings' | 'currencies' | 'baseRates'>;

const configOf = (b: YearBook): YearConfig => ({ items: b.items, holdings: b.holdings, currencies: b.currencies, baseRates: b.baseRates });
const sharedSettingsOf = (s: Settings) => Object.fromEntries(SHARED_SETTINGS.map((k) => [k, s[k]]));

/** 每個單位的內容（JSON 字串），用來比較是否有變動 */
export function units(data: AppData): Record<UnitKey, string> {
  const out: Record<UnitKey, string> = { settings: JSON.stringify(sharedSettingsOf(data.settings)) };
  for (const b of Object.values(data.years)) {
    out[`${b.year}/config`] = JSON.stringify(configOf(b));
    b.months.forEach((m, i) => (out[`${b.year}/${i}`] = JSON.stringify(m)));
  }
  return out;
}

/** 兩份資料之間內容不同（含新增）的單位 */
export function changedUnits(before: AppData, after: AppData): UnitKey[] {
  const a = units(before);
  const b = units(after);
  return Object.keys(b).filter((k) => a[k] !== b[k]);
}

export function stampChanges(stamps: Stamps, before: AppData, after: AppData, deviceId: string, now = Date.now()): Stamps {
  const keys = changedUnits(before, after);
  if (!keys.length) return stamps;
  const next = { ...stamps };
  for (const k of keys) next[k] = { t: now, d: deviceId };
  return next;
}

/** 把每個單位都標成「現在修改」：選擇「用這台的資料」覆蓋雲端時使用 */
export function stampAll(data: AppData, deviceId: string, now = Date.now()): Stamps {
  return Object.fromEntries(Object.keys(units(data)).map((k) => [k, { t: now, d: deviceId }]));
}

function ensureYear(data: AppData, year: number): YearBook {
  return (data.years[year] ??= { year, items: [], holdings: [], currencies: [], baseRates: {}, months: Array.from({ length: 12 }, emptyMonth) });
}

/** 把 from 的某個單位複製到 to */
function applyUnit(to: AppData, from: AppData, key: UnitKey): void {
  if (key === 'settings') {
    for (const k of SHARED_SETTINGS) (to.settings as unknown as Record<string, unknown>)[k] = from.settings[k];
    return;
  }
  const [y, part] = key.split('/');
  const src = from.years[y];
  if (!src) return;
  const dst = ensureYear(to, Number(y));
  if (part === 'config') Object.assign(dst, structuredClone(configOf(src)));
  else dst.months[Number(part)] = structuredClone(src.months[Number(part)]) as MonthEntry;
}

export interface Conflict {
  key: UnitKey;
  /** 被採用的版本 */
  kept: 'local' | 'cloud';
  keptStamp: Stamp;
}

export interface MergeResult {
  data: AppData;
  stamps: Stamps;
  conflicts: Conflict[];
  /** 這台裝置的資料有被雲端更新 */
  localChanged: boolean;
  /** 需要把結果上傳到雲端 */
  cloudChanged: boolean;
}

/**
 * 逐一比對每個單位，保留修改時間較新的那份（時間相同時以雲端為準）。
 * @param synced 上次同步成功時的修改時間；兩邊都比它新且內容不同，就算衝突
 */
export function mergeSync(
  local: { data: AppData; stamps: Stamps },
  cloud: { data: AppData; stamps: Stamps },
  synced: Stamps,
): MergeResult {
  const lu = units(local.data);
  const cu = units(cloud.data);
  const data = structuredClone(local.data);
  const stamps: Stamps = {};
  const conflicts: Conflict[] = [];
  let localChanged = false;
  let cloudChanged = false;
  const zero: Stamp = { t: 0, d: '' };

  for (const key of new Set([...Object.keys(lu), ...Object.keys(cu)])) {
    const ls = local.stamps[key] ?? zero;
    const cs = cloud.stamps[key] ?? zero;
    if (!(key in cu)) {
      stamps[key] = ls;
      cloudChanged = true;
      continue;
    }
    if (!(key in lu)) {
      applyUnit(data, cloud.data, key);
      stamps[key] = cs;
      localChanged = true;
      continue;
    }
    if (lu[key] === cu[key]) {
      stamps[key] = ls.t >= cs.t ? ls : cs;
      continue;
    }
    const useLocal = ls.t > cs.t;
    const base = synced[key]?.t ?? 0;
    if (ls.t > base && cs.t > base) conflicts.push({ key, kept: useLocal ? 'local' : 'cloud', keptStamp: useLocal ? ls : cs });
    if (useLocal) {
      stamps[key] = ls;
      cloudChanged = true;
    } else {
      applyUnit(data, cloud.data, key);
      stamps[key] = cs;
      localChanged = true;
    }
  }
  return { data, stamps, conflicts, localChanged, cloudChanged };
}

// ---- 雲端檔案格式 ----

export const CLOUD_FORMAT = 1;

export interface CloudDoc {
  app: string;
  kind: 'sync';
  format: number;
  savedAt: string;
  deviceId: string;
  stamps: Stamps;
  data: AppData;
}

export function toCloud(data: AppData, stamps: Stamps, deviceId: string, now = new Date()): CloudDoc {
  const settings: Settings = { ...defaultSettings(), ...sharedSettingsOf(data.settings), onboarded: true };
  return { app: APP_ID, kind: 'sync', format: CLOUD_FORMAT, savedAt: now.toISOString(), deviceId, stamps, data: { ...data, settings } };
}

/** 解析雲端檔案；資料版本較舊會自動升級，比網頁新會丟出 NewerVersionError */
export function fromCloud(text: string): { data: AppData; stamps: Stamps; savedAt: string } {
  const doc = JSON.parse(text) as Partial<CloudDoc>;
  if (!doc || doc.app !== APP_ID || doc.kind !== 'sync' || !doc.data) throw new Error('雲端檔案格式不正確');
  return { data: migrate(doc.data), stamps: doc.stamps ?? {}, savedAt: doc.savedAt ?? '' };
}

/** 套用雲端資料到這台裝置，保留這台裝置專屬的設定 */
export function withDeviceSettings(cloudData: AppData, device: Settings): AppData {
  const out = structuredClone(cloudData);
  out.settings = { ...device, ...sharedSettingsOf(cloudData.settings), onboarded: true, isSample: false };
  return out;
}

/** 這台裝置是否有值得保留的資料（已完成設定且不是範例） */
export function hasOwnData(data: AppData): boolean {
  return data.settings.onboarded && !data.settings.isSample;
}

export type FirstLink = 'upload' | 'download' | 'choose';

/** 第一次在這台裝置連結雲端時要怎麼做 */
export function firstLinkAction(local: AppData, cloudExists: boolean): FirstLink {
  if (!cloudExists) return 'upload';
  return hasOwnData(local) ? 'choose' : 'download';
}

/** 衝突提示用的單位名稱 */
export function unitLabel(key: UnitKey): string {
  if (key === 'settings') return '共用設定';
  const [y, part] = key.split('/');
  return part === 'config' ? `${y} 年的項目設定` : `${y} 年 ${Number(part) + 1} 月`;
}
