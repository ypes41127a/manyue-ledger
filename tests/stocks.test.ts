import { describe, expect, it } from 'vitest';
import { emptyYear } from '../src/core/defaults';
import { computeStocks } from '../src/core/stocks';
import { excelBook } from './fixtures';

describe('股票計算（對照 Excel 股票版填寫範例）', () => {
  const s = computeStocks(excelBook());

  it('持股現值總計', () => {
    expect(s.totalValue[0]).toBe(1051250);
    expect(s.totalValue[11]).toBe(1222760);
  });

  it('未實現損益與獲利率', () => {
    expect(s.market.TW.pl[0]).toBe(86500);
    expect(s.market.TW.plRate[0]).toBeCloseTo(0.186624, 6);
    expect(s.market.US.pl[2]).toBe(20690);
    expect(s.unrealPl).toEqual([99750, -41650, -72810, -3150, 54430, 43490, 94090, 214530, 219125, 164400, 147350, 259860]);
    expect(s.annual.unrealPl).toBe(259860);
    expect(s.annual.unrealRate).toBeCloseTo(0.269872, 6);
  });

  it('已實現損益與報酬率', () => {
    expect(s.realized).toEqual([9000, 44571, -1000, -1000, 57500, 0, -10000, 7000, 36000, -1100, 3000, -4000]);
    expect(s.realizedRate[0]).toBeCloseTo(0.042654, 6);
    expect(s.realizedRate[5]).toBeNull(); // Excel 顯示 #DIV/0!
    expect(s.market.US.realizedRate[2]).toBeNull();
    expect(s.annualByMarket.TW.realized).toBe(95971);
    expect(s.annualByMarket.TW.realizedRate).toBeCloseTo(0.0663744, 6);
    expect(s.annualByMarket.US.realizedRate).toBeCloseTo(0.0729685, 6);
    expect(s.annual.realized).toBe(139971);
    expect(s.annual.realizedRate).toBeCloseTo(0.0683151, 6);
  });

  it('交易成本 = 手續費 − 電子折讓 + 證交稅', () => {
    expect(s.netCost).toEqual([1059, 573, 1082, 1325, 1082, 0, 243, 1325, 1325, 1325, 243, 1325]);
    expect(s.annual.netCost).toBe(10907);
  });

  it('股息', () => {
    expect(s.cashDiv).toEqual([2750, 0, 3500, 2750, 0, 3850, 2750, 0, 43320, 2750, 0, 5230]);
    expect(s.annual.cashDiv).toBe(66900);
    expect(s.cashDivCumulative[11]).toBe(66900);
  });
});

describe('美股以美元輸入並用當月匯率換算', () => {
  it('市值、成本、已實現、交易成本、股利', () => {
    const b = emptyYear(2026);
    b.holdings = [{ id: 'u', code: 'AAPL', name: '蘋果', market: 'US' }];
    for (const m of [0, 1]) {
      const e = b.months[m];
      e.started = true;
      e.shares.u = 10;
      e.prices.u = 200;
      e.stock.US = { cost: 1500, sell: 300, buy: 200, fee: 3, rebate: 1, tax: 0 };
      e.cashDiv.u = 5;
    }
    b.months[1].rates.USD = 30;
    const s = computeStocks(b);
    expect(s.market.US.value[0]).toBeCloseTo(2000 * 31.37, 6);
    expect(s.market.US.value[1]).toBe(60000);
    expect(s.market.US.cost[1]).toBe(45000);
    expect(s.market.US.plRate[1]).toBeCloseTo(1 / 3, 10);
    expect(s.market.US.realized[1]).toBe(3000);
    expect(s.market.US.netCost[1]).toBe(60);
    expect(s.cashDiv[1]).toBe(150);
    expect(s.last).toBe(1);
    expect(s.annual.value).toBe(60000);
  });

  it('沒有持股也沒有 NaN', () => {
    const s = computeStocks(emptyYear(2026));
    expect(s.annual.unrealRate).toBeNull();
    expect(s.annual.realizedRate).toBeNull();
    expect(s.unrealRate.every((v) => v === null)).toBe(true);
  });
});
