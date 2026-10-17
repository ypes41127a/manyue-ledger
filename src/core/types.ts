// 資料模型。任何欄位變動都要調高 CURRENT_SCHEMA 並在 migrate.ts 補上升級步驟。
export const CURRENT_SCHEMA = 2;
export const APP_ID = 'manyue-ledger';

export type Section = 'asset' | 'income' | 'expense' | 'invest' | 'liability';
export type Market = 'TW' | 'US';

/**
 * fx：輸入原幣金額，以當月匯率換算
 * stockTW / stockUS：由股票分頁持股現值自動帶入
 * interestDividend：手動輸入銀行利息，再自動加上股票現金股利
 */
export type ItemKind = 'fx' | 'stockTW' | 'stockUS' | 'interestDividend';

export interface Item {
  id: string;
  section: Section;
  group: string;
  name: string;
  kind?: ItemKind;
  /** kind 為 fx 時的幣別代碼 */
  currency?: string;
  /** 每月固定項目：填寫精靈會帶入上個月的數值（資產與負債一律帶入） */
  carry?: boolean;
  /** 每月可填寫備註（例如其他收入的來源） */
  note?: boolean;
}

export interface Holding {
  id: string;
  code: string;
  name: string;
  market: Market;
}

export interface Currency {
  code: string;
  name: string;
}

/** 股票分頁每個市場的手動欄位。美股以美元輸入。 */
export interface MarketMonth {
  cost?: number;
  sell?: number;
  buy?: number;
  fee?: number;
  rebate?: number;
  tax?: number;
  unrealNote?: string;
  realNote?: string;
}

export interface MonthEntry {
  /** 是否已開始填寫（已帶入上月數值） */
  started: boolean;
  completed: boolean;
  completedAt?: string;
  /** 幣別代碼 → 對台幣匯率；未填則沿用上個月 */
  rates: Record<string, number>;
  /** 項目 id → 金額（fx 項目為原幣） */
  values: Record<string, number>;
  /** 項目 id → 當月備註 */
  notes: Record<string, string>;
  shares: Record<string, number>;
  prices: Record<string, number>;
  stock: Record<Market, MarketMonth>;
  cashDiv: Record<string, number>;
  stockDiv: Record<string, number>;
}

export interface YearBook {
  year: number;
  items: Item[];
  holdings: Holding[];
  currencies: Currency[];
  /** 年初匯率，1 月尚未填匯率時使用 */
  baseRates: Record<string, number>;
  months: MonthEntry[];
}

export interface LockInfo {
  salt: string;
  hash: string;
  iterations: number;
}

export interface Settings {
  onboarded: boolean;
  isSample: boolean;
  fillDay: number;
  liabilitiesEnabled: boolean;
  lock?: LockInfo;
  lastBackupAt?: string;
}

export interface AppData {
  schemaVersion: number;
  years: Record<string, YearBook>;
  settings: Settings;
}

export const MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export const MARKETS: Market[] = ['TW', 'US'];
export const MARKET_LABEL: Record<Market, string> = { TW: '台股', US: '美股' };
export const SECTION_LABEL: Record<Section, string> = {
  asset: '資產',
  income: '收入',
  expense: '支出',
  invest: '支出轉資產',
  liability: '負債',
};
