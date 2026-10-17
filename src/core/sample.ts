// 範例資料，取自原始 Excel「滿月記帳法(填寫範例&FAQ)」與「股票版(填寫範例)」工作表。
import { defaultSettings, emptyMonth } from './defaults';
import { CURRENT_SCHEMA, MONTHS } from './types';
import type { AppData, Holding, Item, Market, YearBook } from './types';

type Row = readonly number[];
const all = (v: number): Row => MONTHS.map(() => v);
/** 只有某些月份有值：at({1: 1500, 3: 1400}) 表示 1 月與 3 月 */
const at = (byMonth: Record<number, number>): Row => MONTHS.map((m) => byMonth[m + 1] ?? 0);

export const EXCEL_LEDGER = {
  assets: [
    ['台幣活存', [30000, 25000, 18500, 18500, 19000, 17000, 16500, 17800, 20000, 25000, 28000, 32000]],
    ['台幣定存', [10000, 10000, 10000, 10000, 10000, 10000, 20000, 20000, 15000, 16500, 18000, 18000]],
    ['外幣定存(美元)', [29300, 29700, 30100, 30100, 30100, 32000, 32000, 32000, 32000, 32000, 32000, 32000]],
    ['股票', [237000, 259500, 302500, 302500, 330000, 350000, 350000, 350000, 370000, 380000, 390000, 390000]],
    ['基金', [50300, 49800, 52500, 55000, 52500, 52500, 52500, 52500, 52500, 55000, 56000, 57000]],
    ['儲蓄險/投資型保單', [55000, 58000, 58500, 58500, 58500, 58500, 58500, 58500, 58500, 60000, 61000, 62000]],
  ],
  income: [
    ['薪資', all(45000)],
    ['獎金', at({ 1: 30000, 2: 3000, 5: 3000, 9: 3000 })],
    ['銀行利息/股利', at({ 4: 5000, 7: 8000, 11: 3400 })],
    ['其他收入1(中發票)', at({ 3: 1000 })],
    ['其他收入2(外送)', at({ 2: 8500, 4: 10000, 5: 7580 })],
    ['其他收入3(設計接案)', at({ 3: 5000, 6: 3500 })],
  ],
  planned: [
    ['房租+管理費', all(20000)],
    ['水費', at({ 2: 450, 4: 462, 6: 585 })],
    ['電費', at({ 1: 1500, 3: 1400 })],
    ['天然瓦斯', at({ 1: 450, 3: 390, 5: 520, 7: 480 })],
    ['手機費', all(1399)],
    ['孝親費/紅包', MONTHS.map((m) => (m === 1 ? 42000 : 5000))],
    ['學貸', all(6000)],
    ['iPhone 分六期', at({ 3: 7000, 4: 7000, 5: 7000, 6: 7000, 7: 7000, 8: 7000 })],
    ['保費(意外/醫療/車險)', at({ 3: 25800, 6: 1500 })],
  ],
  unplanned: [
    ['餐飲', at({ 1: 1730, 3: 880 })],
    ['衣服鞋子', at({ 2: 790, 3: 390 })],
    ['寵物', at({ 2: 1500, 3: 599 })],
    ['機車保養維修', at({ 1: 480, 3: 1250 })],
    ['親友紅包', at({ 3: 3600 })],
    ['出國-北海道', at({ 4: 50000 })],
  ],
  invest: [
    ['基金定期定額', all(3000)],
    ['投資外幣', all(0)],
    ['轉定存', at({ 2: 50000 })],
    ['繳儲蓄險保費', at({ 4: 20000 })],
    ['買股票', all(0)],
  ],
} satisfies Record<string, [string, Row][]>;

/** 股票版範例。A 券商＝台股、B 券商＝美股，金額皆為台幣。 */
export const EXCEL_STOCK = {
  shares: {
    '2330': [200, 300, 400, 500, 700, 1000, 1200, 1500, 2000, 2000, 2100, 2200],
    '2886': [2000, 3000, 5000, 8000, 6000, 6000, 7000, 10000, 10000, 12000, 12000, 15000],
    '0050': [1000, 1000, 2000, 2500, 2500, 3000, 3000, 4000, 3000, 3000, 3000, 3000],
    '00878': [5000, 8000, 10000, 12000, 12000, 15000, 20000, 22000, 23000, 25000, 25000, 22000],
    AAPL: [10, 15, 16, 18, 20, 30, 35, 30, 28, 35, 40, 35],
    NVDA: [12, 10, 11, 11, 10, 10, 15, 15, 15, 18, 18, 20],
    SPY: [5, 8, 12, 10, 8, 12, 20, 20, 20, 22, 25, 22],
    QQQ: [20, 22, 25, 22, 20, 18, 20, 21, 22, 23, 25, 20],
  } as Record<string, Row>,
  TW: {
    value: [550000, 482500, 356500, 366250, 212000, 208900, 305690, 459680, 667600, 858910, 910050, 1002560],
    cost: [463500, 520000, 450000, 400000, 190000, 180000, 200000, 250000, 450000, 678900, 757700, 757700],
    sell: [210000, 586975, 48000, 48000, 200000, 0, 0, 250000, 60000, 88900, 0, 50000],
    buy: [200000, 566404, 49000, 49000, 142500, 0, 0, 238000, 57000, 90000, 0, 54000],
    fee: [810, 434, 1181, 1181, 1181, 0, 0, 1181, 1181, 1181, 0, 1181],
    rebate: [333, 190, 727, 727, 727, 0, 0, 727, 727, 727, 0, 727],
    tax: [339, 329, 628, 628, 628, 0, 0, 628, 628, 628, 0, 628],
    unrealNote: ['金融股', '金融股、鋼鐵', '金融股', '金融股', '高股息 ETF', 'ETF、半導體', '金融股', '金融股', '金融、電信', '金融、ETF', '金融股', '金融股'],
    realNote: ['先出一趟', '開紅盤搶個短', '賣在阿呆谷', '不爽減資', 'KD 高檔鈍化', '本月無賣出', '本月無賣出', '除息前賣', '正乖離太大先出', '報價下跌', '本月無賣出', '破線'],
  },
  US: {
    value: [501250, 400850, 32690, 446600, 267430, 182590, 193600, 210050, 206725, 189590, 200200, 220200],
    cost: [488000, 405000, 12000, 416000, 235000, 168000, 205200, 205200, 205200, 205200, 205200, 205200],
    sell: [10000, 224000, 0, 0, 0, 0, 50000, 125000, 168000, 0, 70000, 0],
    buy: [11000, 200000, 0, 0, 0, 0, 60000, 130000, 135000, 0, 67000, 0],
    fee: [282, 0, 0, 282, 0, 0, 282, 282, 282, 282, 282, 282],
    rebate: [98, 0, 0, 98, 0, 0, 98, 98, 98, 98, 98, 98],
    tax: [59, 0, 0, 59, 0, 0, 59, 59, 59, 59, 59, 59],
    unrealNote: ['SPY、VOO', 'AAPL', 'NVDA', 'MSFT', 'VTI、QQQ', 'MSFT', 'AAPL', 'AAPL', 'AAPL', 'AAPL', 'AAPL', 'AAPL'],
    realNote: ['投信翻空', '外資轉賣', '本月無賣出', '本月無賣出', '本月無賣出', '本月無賣出', '營收衰退', '產業利空', '波段了結', '本月無賣出', '波段了結', '本月無賣出'],
  },
  cashDiv: {
    '2330': at({ 1: 2750, 4: 2750, 7: 2750, 10: 2750 }),
    '2886': at({ 9: 28560 }),
    '2892': at({ 9: 10500 }),
    '00878': at({ 3: 3500, 6: 3850, 9: 4260, 12: 5230 }),
  } as Record<string, Row>,
  stockDiv: { '2892': at({ 9: 300 }) } as Record<string, Row>,
};

const USD = 31.37;
// Excel 範例沒有收盤價，以下為編造的參考價（台股為台幣、美股為美元），再乘上每月漲跌幅
const BASE_PRICE: Record<string, number> = {
  '2330': 1000, '2886': 40, '0050': 50, '00878': 21, '2892': 28,
  AAPL: 230, NVDA: 135, SPY: 590, QQQ: 510,
};
const TREND = [1, 0.97, 0.93, 0.95, 1.01, 1.04, 1.08, 1.06, 1.1, 1.13, 1.12, 1.16];

const HOLDINGS: Holding[] = [
  { id: 'h-2330', code: '2330', name: '台積電', market: 'TW' },
  { id: 'h-2886', code: '2886', name: '兆豐金', market: 'TW' },
  { id: 'h-2892', code: '2892', name: '第一金', market: 'TW' },
  { id: 'h-0050', code: '0050', name: '元大台灣50', market: 'TW' },
  { id: 'h-00878', code: '00878', name: '國泰永續高股息', market: 'TW' },
  { id: 'h-AAPL', code: 'AAPL', name: '蘋果', market: 'US' },
  { id: 'h-NVDA', code: 'NVDA', name: 'NVIDIA', market: 'US' },
  { id: 'h-SPY', code: 'SPY', name: 'ETF A', market: 'US' },
  { id: 'h-QQQ', code: 'QQQ', name: 'ETF B', market: 'US' },
];

function sampleBook(year: number): YearBook {
  const L = EXCEL_LEDGER;
  const S = EXCEL_STOCK;
  const items: Item[] = [];
  const rows: [string, Row][] = [];
  const add = (item: Omit<Item, 'id'>, row: Row) => {
    const id = `s-${items.length}`;
    items.push({ id, ...item });
    rows.push([id, row]);
  };

  add({ section: 'asset', group: '存款', name: '台幣活存' }, L.assets[0][1]);
  add({ section: 'asset', group: '存款', name: '台幣定存' }, L.assets[1][1]);
  // 外幣定存改以美元原幣輸入，示範匯率換算
  add({ section: 'asset', group: '外幣', name: '外幣定存(美元)', kind: 'fx', currency: 'USD' }, L.assets[2][1].map((v) => Math.round(v / USD)));
  add({ section: 'asset', group: '投資', name: '基金' }, L.assets[4][1]);
  add({ section: 'asset', group: '投資', name: '儲蓄險/投資型保單' }, L.assets[5][1]);
  // Excel 的「股票」列改由股票分頁自動帶入
  add({ section: 'asset', group: '股票', name: '台股', kind: 'stockTW' }, all(0));
  add({ section: 'asset', group: '股票', name: '美股', kind: 'stockUS' }, all(0));

  add({ section: 'income', group: '薪資', name: L.income[0][0], carry: true }, L.income[0][1]);
  add({ section: 'income', group: '獎金', name: L.income[1][0] }, L.income[1][1]);
  add({ section: 'income', group: '利息/股利', name: '利息/股利', kind: 'interestDividend' }, L.income[2][1]);
  for (const [name, row] of L.income.slice(3)) add({ section: 'income', group: '其他收入', name, note: true }, row);
  for (const [name, row] of L.planned) add({ section: 'expense', group: '固定支出', name, carry: true }, row);
  for (const [name, row] of L.unplanned) add({ section: 'expense', group: '非固定支出', name }, row);
  for (const [name, row] of L.invest) add({ section: 'invest', group: '投資', name }, row);

  // Excel 範例的股數搭配編造的股價會讓股票遠大於其他資產，這裡縮小為十分之一
  const sharesOf = (h: Holding, m: number) => (h.code === '2892' ? (m >= 8 ? 1030 : 1000) : S.shares[h.code][m] / 10);
  const priceOf = (h: Holding, m: number) => {
    const p = BASE_PRICE[h.code] * TREND[m];
    return h.market === 'TW' ? Math.round(p * 10) / 10 : Math.round(p * 100) / 100;
  };
  const toInput = (mk: Market, twd: number) => (mk === 'US' ? Math.round((twd / USD) * 100) / 100 : twd);

  const months = MONTHS.map((m) => {
    const e = emptyMonth();
    e.started = true;
    e.completed = true;
    e.rates = { USD, JPY: 0.2 };
    for (const [id, row] of rows) if (row[m] !== 0) e.values[id] = row[m];
    for (const h of HOLDINGS) {
      e.shares[h.id] = sharesOf(h, m);
      e.prices[h.id] = priceOf(h, m);
      const cd = S.cashDiv[h.code]?.[m];
      if (cd) e.cashDiv[h.id] = cd;
      const sd = S.stockDiv[h.code]?.[m];
      if (sd) e.stockDiv[h.id] = sd;
    }
    for (const mk of ['TW', 'US'] as const) {
      const x = S[mk];
      const value = HOLDINGS.filter((h) => h.market === mk).reduce(
        (t, h) => t + sharesOf(h, m) * priceOf(h, m) * (mk === 'US' ? USD : 1),
        0,
      );
      e.stock[mk] = {
        // 市值是編造的，成本依 Excel 範例的「成本／現值」比例換算，讓獲利率與原範例一致
        cost: toInput(mk, Math.round((value * x.cost[m]) / x.value[m])),
        sell: toInput(mk, x.sell[m]),
        buy: toInput(mk, x.buy[m]),
        fee: toInput(mk, x.fee[m]),
        rebate: toInput(mk, x.rebate[m]),
        tax: toInput(mk, x.tax[m]),
        unrealNote: x.unrealNote[m],
        realNote: x.realNote[m],
      };
    }
    return e;
  });

  return {
    year,
    items,
    holdings: HOLDINGS.map((h) => ({ ...h })),
    currencies: [
      { code: 'USD', name: '美元' },
      { code: 'JPY', name: '日幣' },
    ],
    baseRates: { USD, JPY: 0.2 },
    months,
  };
}

export function sampleAppData(year: number): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA,
    years: { [year]: sampleBook(year) },
    settings: { ...defaultSettings(), onboarded: true, isSample: true },
  };
}
