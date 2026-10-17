import { num, safeDiv, sum } from './safe';
import { computeStocks, monthActive, rateOf } from './stocks';
import type { StockYear } from './stocks';
import { MONTHS } from './types';
import type { Item, Section, Settings, YearBook } from './types';

export interface GroupCalc {
  group: string;
  items: Item[];
  values: number[];
}

export interface LedgerYear {
  /** 項目 id → 每月金額（台幣） */
  itemValues: Record<string, number[]>;
  /** 項目 id → Total 欄：資產/負債為期末 − 期初，其餘為全年加總 */
  itemTotal: Record<string, number>;
  /** 項目 id → % 欄：資產/負債為成長率，其餘為占該區塊比例 */
  itemPct: Record<string, number | null>;
  groups: Record<Section, GroupCalc[]>;
  totals: Record<Section, number[]>;
  sectionTotal: Record<Section, number>;
  sectionPct: Record<Section, number | null>;
  netWorth: number[];
  growth: (number | null)[];
  savingsRate: (number | null)[];
  netWorthChange: number;
  netWorthChangePct: number | null;
  active: boolean[];
  first: number;
  last: number;
  stocks: StockYear;
}

const SECTIONS: Section[] = ['asset', 'income', 'expense', 'invest', 'liability'];
/** 餘額型區塊：Total 欄看的是期末與期初的差額，不是加總 */
const isBalance = (s: Section) => s === 'asset' || s === 'liability';

export function itemMonthValue(book: YearBook, item: Item, month: number, stocks: StockYear): number {
  const raw = num(book.months[month].values[item.id]);
  switch (item.kind) {
    case 'fx':
      return raw * rateOf(book, month, item.currency ?? '');
    case 'stockTW':
      return stocks.market.TW.value[month];
    case 'stockUS':
      return stocks.market.US.value[month];
    case 'interestDividend':
      return raw + stocks.cashDiv[month];
    default:
      return raw;
  }
}

/**
 * @param prevDecNetWorth 前一年度 12 月的淨值，用來計算 1 月成長率與年初至今成長
 */
export function computeLedger(
  book: YearBook,
  settings: Pick<Settings, 'liabilitiesEnabled'>,
  prevDecNetWorth: number | null = null,
): LedgerYear {
  const stocks = computeStocks(book);
  const active = MONTHS.map((m) => monthActive(book, m));
  const first = active.indexOf(true);
  const last = active.lastIndexOf(true);

  const items = book.items.filter((i) => i.section !== 'liability' || settings.liabilitiesEnabled);
  const itemValues: Record<string, number[]> = {};
  for (const it of items) itemValues[it.id] = MONTHS.map((m) => itemMonthValue(book, it, m, stocks));

  const groups = {} as Record<Section, GroupCalc[]>;
  const totals = {} as Record<Section, number[]>;
  for (const s of SECTIONS) {
    const list: GroupCalc[] = [];
    for (const it of items.filter((i) => i.section === s)) {
      let g = list.find((x) => x.group === it.group);
      if (!g) list.push((g = { group: it.group, items: [], values: MONTHS.map(() => 0) }));
      g.items.push(it);
      for (const m of MONTHS) g.values[m] += itemValues[it.id][m];
    }
    groups[s] = list;
    totals[s] = MONTHS.map((m) => sum(list.map((g) => g.values[m])));
  }

  const change = (v: number[]) => (first >= 0 ? v[last] - v[first] : 0);
  const growthOf = (v: number[]) => (first >= 0 ? safeDiv(v[last] - v[first], v[first]) : null);

  const sectionTotal = {} as Record<Section, number>;
  const sectionPct = {} as Record<Section, number | null>;
  const itemTotal: Record<string, number> = {};
  const itemPct: Record<string, number | null> = {};
  for (const s of SECTIONS) {
    sectionTotal[s] = isBalance(s) ? change(totals[s]) : sum(totals[s]);
    sectionPct[s] = isBalance(s) ? growthOf(totals[s]) : sectionTotal[s] === 0 ? null : 1;
    for (const g of groups[s])
      for (const it of g.items) {
        const v = itemValues[it.id];
        itemTotal[it.id] = isBalance(s) ? change(v) : sum(v);
        itemPct[it.id] = isBalance(s) ? growthOf(v) : safeDiv(itemTotal[it.id], sectionTotal[s]);
      }
  }

  // 個人淨值 = 資產總計 − 當月支出總計（同原始滿月記帳表），開啟負債後再減負債
  const netWorth = MONTHS.map((m) => totals.asset[m] - totals.expense[m] - totals.liability[m]);
  const growth = MONTHS.map((m) => {
    if (!active[m]) return null;
    if (m === 0) return prevDecNetWorth === null ? null : safeDiv(netWorth[0] - prevDecNetWorth, prevDecNetWorth);
    return active[m - 1] ? safeDiv(netWorth[m] - netWorth[m - 1], netWorth[m - 1]) : null;
  });
  const savingsRate = MONTHS.map((m) =>
    active[m] ? safeDiv(totals.income[m] - totals.expense[m], totals.income[m]) : null,
  );

  const base = prevDecNetWorth ?? (first >= 0 ? netWorth[first] : null);
  const netWorthChange = last >= 0 && base !== null ? netWorth[last] - base : 0;

  return {
    itemValues,
    itemTotal,
    itemPct,
    groups,
    totals,
    sectionTotal,
    sectionPct,
    netWorth,
    growth,
    savingsRate,
    netWorthChange,
    netWorthChangePct: last >= 0 ? safeDiv(netWorthChange, base) : null,
    active,
    first,
    last,
    stocks,
  };
}

/** 前一年度 12 月淨值；沒有前一年或 12 月沒資料則為 null */
export function prevDecemberNetWorth(
  years: Record<string, YearBook>,
  year: number,
  settings: Pick<Settings, 'liabilitiesEnabled'>,
): number | null {
  const prev = years[year - 1];
  if (!prev || !monthActive(prev, 11)) return null;
  return computeLedger(prev, settings).netWorth[11];
}
