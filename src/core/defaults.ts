import { CURRENT_SCHEMA } from './types';
import type { AppData, Currency, Item, MonthEntry, Settings, YearBook } from './types';

export const DEFAULT_CURRENCIES: Currency[] = [
  { code: 'JPY', name: '日幣' },
  { code: 'USD', name: '美元' },
  { code: 'GBP', name: '英鎊' },
];

export const DEFAULT_RATES: Record<string, number> = { JPY: 0.2, USD: 31.37, GBP: 42.25 };

export function defaultItems(): Item[] {
  return [
    { id: 'a-bank-a', section: 'asset', group: '生活', name: '銀行帳戶 A' },
    { id: 'a-bank-b', section: 'asset', group: '生活', name: '銀行帳戶 B' },
    { id: 'a-cash', section: 'asset', group: '生活', name: '現金/電子支付' },
    { id: 'a-invest', section: 'asset', group: '投資', name: '投資帳戶' },
    { id: 'a-reserve', section: 'asset', group: '備用', name: '備用帳戶' },
    { id: 'a-jpy', section: 'asset', group: '外幣', name: '日幣', kind: 'fx', currency: 'JPY' },
    { id: 'a-usd', section: 'asset', group: '外幣', name: '美元', kind: 'fx', currency: 'USD' },
    { id: 'a-gbp', section: 'asset', group: '外幣', name: '英鎊', kind: 'fx', currency: 'GBP' },
    { id: 'a-stock-tw', section: 'asset', group: '股票', name: '台股', kind: 'stockTW' },
    { id: 'a-stock-us', section: 'asset', group: '股票', name: '美股', kind: 'stockUS' },

    { id: 'i-salary', section: 'income', group: '每月薪資', name: '每月薪資', carry: true },
    { id: 'i-bonus', section: 'income', group: '獎金', name: '獎金' },
    { id: 'i-interest', section: 'income', group: '利息/股利', name: '利息/股利', kind: 'interestDividend' },
    { id: 'i-other', section: 'income', group: '其他收入', name: '其他收入', note: true },

    { id: 'e-family', section: 'expense', group: '固定支出', name: '孝親費', carry: true },
    { id: 'e-rent', section: 'expense', group: '固定支出', name: '房租', carry: true },
    // 水電費多為雙月繳、金額會變動，不自動帶入上月
    { id: 'e-utility', section: 'expense', group: '固定支出', name: '水電費' },
    { id: 'e-telecom', section: 'expense', group: '固定支出', name: '電信費', carry: true },
    { id: 'e-subscription', section: 'expense', group: '固定支出', name: '訂閱費', carry: true },
    { id: 'e-fixed-other', section: 'expense', group: '固定支出', name: '其他', note: true },
    { id: 'e-meal', section: 'expense', group: '非固定支出', name: '餐費' },
    { id: 'e-transport', section: 'expense', group: '非固定支出', name: '交通費' },
    { id: 'e-shopping', section: 'expense', group: '非固定支出', name: '娛樂/購物費' },
    { id: 'e-travel', section: 'expense', group: '非固定支出', name: '旅遊' },
    { id: 'e-other', section: 'expense', group: '非固定支出', name: '其他', note: true },

    { id: 'v-tw', section: 'invest', group: '投資', name: '進台股' },
    { id: 'v-us', section: 'invest', group: '投資', name: '進美股' },
    { id: 'v-fx', section: 'invest', group: '投資', name: '換外幣' },
    { id: 'v-jpy', section: 'invest', group: '投資', name: '換日幣' },
    { id: 'v-other', section: 'invest', group: '投資', name: '其他', note: true },
  ];
}

export function emptyMonth(): MonthEntry {
  return {
    started: false,
    completed: false,
    rates: {},
    values: {},
    notes: {},
    shares: {},
    prices: {},
    stock: { TW: {}, US: {} },
    cashDiv: {},
    stockDiv: {},
  };
}

export function emptyYear(year: number): YearBook {
  return {
    year,
    items: defaultItems(),
    holdings: [],
    currencies: DEFAULT_CURRENCIES.map((c) => ({ ...c })),
    baseRates: { ...DEFAULT_RATES },
    months: Array.from({ length: 12 }, emptyMonth),
  };
}

export function defaultSettings(): Settings {
  return { onboarded: false, isSample: false, fillDay: 1, liabilitiesEnabled: false };
}

export function emptyAppData(year: number): AppData {
  return { schemaVersion: CURRENT_SCHEMA, years: { [year]: emptyYear(year) }, settings: defaultSettings() };
}
