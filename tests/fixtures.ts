import { emptyMonth } from '../src/core/defaults';
import { EXCEL_LEDGER, EXCEL_STOCK } from '../src/core/sample';
import { MONTHS } from '../src/core/types';
import type { Item, YearBook } from '../src/core/types';

/**
 * 把 Excel 填寫範例原封不動搬進資料模型（全部視為台幣、美元匯率設為 1），
 * 用來逐格比對計算結果與 Excel 是否一致。
 */
export function excelBook(): YearBook {
  const items: Item[] = [];
  const months = MONTHS.map(() => ({ ...emptyMonth(), started: true, completed: true }));
  const put = (section: Item['section'], group: string, rows: [string, readonly number[]][]) => {
    for (const [name, row] of rows) {
      const id = `x-${items.length}`;
      items.push({ id, section, group, name });
      for (const m of MONTHS) months[m].values[id] = row[m];
    }
  };
  put('asset', '資產', EXCEL_LEDGER.assets);
  put('income', '收入', EXCEL_LEDGER.income);
  put('expense', '計劃', EXCEL_LEDGER.planned);
  put('expense', '非計劃', EXCEL_LEDGER.unplanned);
  put('invest', '投資', EXCEL_LEDGER.invest);

  // 每個市場用一檔「1 股、股價＝總現值」的持股重現 Excel 手填的總現值
  const holdings = [
    { id: 'tw', code: 'TW', name: 'A券商', market: 'TW' as const },
    { id: 'us', code: 'US', name: 'B券商', market: 'US' as const },
  ];
  for (const m of MONTHS) {
    for (const h of holdings) {
      const x = EXCEL_STOCK[h.market];
      months[m].shares[h.id] = 1;
      months[m].prices[h.id] = x.value[m];
      months[m].stock[h.market] = {
        cost: x.cost[m], sell: x.sell[m], buy: x.buy[m], fee: x.fee[m], rebate: x.rebate[m], tax: x.tax[m],
      };
    }
    // Excel 的股息全部是台股
    months[m].cashDiv.tw = Object.values(EXCEL_STOCK.cashDiv).reduce((t, row) => t + row[m], 0);
  }
  return { year: 2026, items, holdings, currencies: [{ code: 'USD', name: '美元' }], baseRates: { USD: 1 }, months };
}
