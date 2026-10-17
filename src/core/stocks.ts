import { num, safeDiv, sum } from './safe';
import { MARKETS, MONTHS } from './types';
import type { Market, YearBook } from './types';

/** 該月匯率：未填則往前找最近一個月，最後退回年初匯率 */
export function rateOf(book: YearBook, month: number, code: string): number {
  for (let m = month; m >= 0; m--) {
    const r = book.months[m]?.rates[code];
    if (typeof r === 'number' && Number.isFinite(r)) return r;
  }
  return num(book.baseRates[code]);
}

/** 美股金額以美元輸入，換算台幣的乘數 */
export function marketFx(book: YearBook, month: number, market: Market): number {
  return market === 'US' ? rateOf(book, month, 'USD') : 1;
}

export function monthActive(book: YearBook, month: number): boolean {
  const e = book.months[month];
  return !!e && (e.started || e.completed);
}

export interface MarketCalc {
  value: number[];
  cost: number[];
  pl: number[];
  plRate: (number | null)[];
  sell: number[];
  buy: number[];
  realized: number[];
  realizedRate: (number | null)[];
  fee: number[];
  rebate: number[];
  tax: number[];
  netCost: number[];
  cashDiv: number[];
}

export interface StockAnnual {
  value: number;
  cost: number;
  unrealPl: number;
  unrealRate: number | null;
  sell: number;
  buy: number;
  realized: number;
  realizedRate: number | null;
  netCost: number;
  cashDiv: number;
}

export interface StockYear {
  /** 持股 id → 每月市值（台幣） */
  holdingValue: Record<string, number[]>;
  /** 持股 id → 每月現金股利（台幣） */
  holdingCashDiv: Record<string, number[]>;
  market: Record<Market, MarketCalc>;
  totalValue: number[];
  totalCost: number[];
  unrealPl: number[];
  unrealRate: (number | null)[];
  realized: number[];
  realizedRate: (number | null)[];
  netCost: number[];
  cashDiv: number[];
  cashDivCumulative: number[];
  active: boolean[];
  /** 最近一個有資料的月份（0–11），沒有則為 -1 */
  last: number;
  annual: StockAnnual;
  annualByMarket: Record<Market, StockAnnual>;
}

function annualOf(c: MarketCalc, last: number): StockAnnual {
  const value = last >= 0 ? c.value[last] : 0;
  const cost = last >= 0 ? c.cost[last] : 0;
  const buy = sum(c.buy);
  const realized = sum(c.realized);
  return {
    value,
    cost,
    unrealPl: value - cost,
    unrealRate: safeDiv(value - cost, cost),
    sell: sum(c.sell),
    buy,
    realized,
    realizedRate: safeDiv(realized, buy),
    netCost: sum(c.netCost),
    cashDiv: sum(c.cashDiv),
  };
}

export function computeStocks(book: YearBook): StockYear {
  const holdingValue: Record<string, number[]> = {};
  const holdingCashDiv: Record<string, number[]> = {};
  for (const h of book.holdings) {
    holdingValue[h.id] = MONTHS.map((m) => {
      const e = book.months[m];
      return num(e.shares[h.id]) * num(e.prices[h.id]) * marketFx(book, m, h.market);
    });
    holdingCashDiv[h.id] = MONTHS.map((m) => num(book.months[m].cashDiv[h.id]) * marketFx(book, m, h.market));
  }

  const market = {} as Record<Market, MarketCalc>;
  for (const mk of MARKETS) {
    const hs = book.holdings.filter((h) => h.market === mk);
    const field = (key: 'cost' | 'sell' | 'buy' | 'fee' | 'rebate' | 'tax') =>
      MONTHS.map((m) => num(book.months[m].stock[mk][key]) * marketFx(book, m, mk));
    const value = MONTHS.map((m) => sum(hs.map((h) => holdingValue[h.id][m])));
    const cost = field('cost');
    const sell = field('sell');
    const buy = field('buy');
    const fee = field('fee');
    const rebate = field('rebate');
    const tax = field('tax');
    const pl = MONTHS.map((m) => value[m] - cost[m]);
    const realized = MONTHS.map((m) => sell[m] - buy[m]);
    market[mk] = {
      value,
      cost,
      pl,
      plRate: MONTHS.map((m) => safeDiv(pl[m], cost[m])),
      sell,
      buy,
      realized,
      realizedRate: MONTHS.map((m) => safeDiv(realized[m], buy[m])),
      fee,
      rebate,
      tax,
      // 手續費（減項）− 電子折讓（加項）＋ 證交稅（減項）
      netCost: MONTHS.map((m) => fee[m] - rebate[m] + tax[m]),
      cashDiv: MONTHS.map((m) => sum(hs.map((h) => holdingCashDiv[h.id][m]))),
    };
  }

  const both = (pick: (c: MarketCalc) => number[]) => MONTHS.map((m) => pick(market.TW)[m] + pick(market.US)[m]);
  const totalValue = both((c) => c.value);
  const totalCost = both((c) => c.cost);
  const unrealPl = both((c) => c.pl);
  const realized = both((c) => c.realized);
  const buyAll = both((c) => c.buy);
  const cashDiv = both((c) => c.cashDiv);
  let acc = 0;
  const cashDivCumulative = cashDiv.map((v) => (acc += v));

  const active = MONTHS.map((m) => monthActive(book, m));
  const last = active.lastIndexOf(true);
  const annualByMarket = { TW: annualOf(market.TW, last), US: annualOf(market.US, last) };
  const a = annualByMarket;
  const annual: StockAnnual = {
    value: a.TW.value + a.US.value,
    cost: a.TW.cost + a.US.cost,
    unrealPl: a.TW.unrealPl + a.US.unrealPl,
    unrealRate: safeDiv(a.TW.unrealPl + a.US.unrealPl, a.TW.cost + a.US.cost),
    sell: a.TW.sell + a.US.sell,
    buy: a.TW.buy + a.US.buy,
    realized: a.TW.realized + a.US.realized,
    realizedRate: safeDiv(a.TW.realized + a.US.realized, a.TW.buy + a.US.buy),
    netCost: a.TW.netCost + a.US.netCost,
    cashDiv: a.TW.cashDiv + a.US.cashDiv,
  };

  return {
    holdingValue,
    holdingCashDiv,
    market,
    totalValue,
    totalCost,
    unrealPl,
    unrealRate: MONTHS.map((m) => safeDiv(unrealPl[m], totalCost[m])),
    realized,
    realizedRate: MONTHS.map((m) => safeDiv(realized[m], buyAll[m])),
    netCost: both((c) => c.netCost),
    cashDiv,
    cashDivCumulative,
    active,
    last,
    annual,
    annualByMarket,
  };
}
