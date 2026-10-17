import { emptyMonth } from './defaults';
import { rateOf } from './stocks';
import { MARKETS } from './types';
import type { Item, MonthEntry, YearBook } from './types';

function carriesOver(book: YearBook, itemId: string): boolean {
  const it = book.items.find((i) => i.id === itemId);
  if (!it) return false;
  if (it.kind === 'stockTW' || it.kind === 'stockUS' || it.kind === 'interestDividend') return false;
  return it.section === 'asset' || it.section === 'liability' || !!it.carry;
}

/**
 * 第一次打開某個月時，帶入上個月的資產餘額、持股、成本、匯率與固定項目。
 * 已開始填寫的月份不會被覆蓋。
 * @param prevBook 前一年度（填 1 月時用來帶入去年 12 月）
 */
export function prefillMonth(book: YearBook, month: number, prevBook?: YearBook): void {
  const entry = book.months[month];
  if (entry.started || entry.completed) return;

  const srcBook = month > 0 ? book : prevBook;
  const src: MonthEntry | undefined = month > 0 ? book.months[month - 1] : prevBook?.months[11];

  for (const c of book.currencies) entry.rates[c.code] = rateOf(book, month, c.code);

  if (src && srcBook) {
    for (const [id, v] of Object.entries(src.values)) if (carriesOver(book, id)) entry.values[id] = v;
    for (const h of book.holdings) {
      if (src.shares[h.id] !== undefined) entry.shares[h.id] = src.shares[h.id];
      if (src.prices[h.id] !== undefined) entry.prices[h.id] = src.prices[h.id];
    }
    for (const mk of MARKETS) if (src.stock[mk].cost !== undefined) entry.stock[mk].cost = src.stock[mk].cost;
  }
  entry.started = true;
}

/** 建立下一年度：帶入帳戶、持股與 12 月匯率，數值在填 1 月時才帶入 */
export function createNextYear(prev: YearBook): YearBook {
  const baseRates: Record<string, number> = {};
  for (const c of prev.currencies) baseRates[c.code] = rateOf(prev, 11, c.code);
  return {
    year: prev.year + 1,
    items: prev.items.map((i) => ({ ...i })),
    holdings: prev.holdings.map((h) => ({ ...h })),
    currencies: prev.currencies.map((c) => ({ ...c })),
    baseRates,
    months: Array.from({ length: 12 }, emptyMonth),
  };
}

/** 新增項目，放在同區塊同分類的最後一個項目之後（沒有同分類時放在該區塊最後） */
export function addItem(book: YearBook, item: Item): void {
  let at = -1;
  book.items.forEach((i, k) => {
    if (i.section === item.section && i.group === item.group) at = k;
  });
  if (at < 0) book.items.forEach((i, k) => i.section === item.section && (at = k));
  book.items.splice(at < 0 ? book.items.length : at + 1, 0, item);
}

export function removeItem(book: YearBook, id: string): void {
  book.items = book.items.filter((i) => i.id !== id);
  for (const m of book.months) delete m.values[id];
}

export function removeHolding(book: YearBook, id: string): void {
  book.holdings = book.holdings.filter((h) => h.id !== id);
  for (const m of book.months) {
    delete m.shares[id];
    delete m.prices[id];
    delete m.cashDiv[id];
    delete m.stockDiv[id];
  }
}

export function moveInList<T>(list: T[], index: number, delta: number): void {
  const to = index + delta;
  if (index < 0 || to < 0 || to >= list.length) return;
  [list[index], list[to]] = [list[to], list[index]];
}
