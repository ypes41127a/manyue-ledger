import { describe, expect, it } from 'vitest';
import { emptyYear } from '../src/core/defaults';
import { computeLedger } from '../src/core/ledger';
import { safeDiv } from '../src/core/safe';
import { excelBook } from './fixtures';

const off = { liabilitiesEnabled: false };

describe('記帳計算（對照 Excel 填寫範例）', () => {
  const l = computeLedger(excelBook(), off);

  it('資產總計', () => {
    expect(l.totals.asset).toEqual([411600, 432000, 472100, 474600, 500100, 520000, 529500, 530800, 548000, 568500, 585000, 591000]);
    expect(l.sectionTotal.asset).toBe(179400);
    expect(l.sectionPct.asset).toBeCloseTo(0.43586, 5);
  });

  it('收入總計與占比', () => {
    expect(l.totals.income).toEqual([75000, 56500, 51000, 60000, 55580, 48500, 53000, 45000, 48000, 45000, 48400, 45000]);
    expect(l.sectionTotal.income).toBe(630980);
    expect(l.itemPct['x-6']).toBeCloseTo(0.855812, 5); // 薪資
  });

  it('支出總計（Excel 範例的「負債」區塊）', () => {
    expect(l.totals.expense).toEqual([36559, 72139, 73708, 89861, 39919, 41484, 39879, 39399, 32399, 32399, 32399, 32399]);
    expect(l.sectionTotal.expense).toBe(562544);
    expect(l.groups.expense.map((g) => g.group)).toEqual(['計劃', '非計劃']);
    expect(l.itemPct['x-12']).toBeCloseTo(0.426633, 5); // 房租
  });

  it('支出轉資產單獨統計，不計入支出總計', () => {
    expect(l.totals.invest[0]).toBe(3000);
    expect(l.totals.invest[1]).toBe(53000);
    expect(l.sectionTotal.invest).toBe(106000);
  });

  it('個人淨值 = 資產 − 當月支出', () => {
    expect(l.netWorth).toEqual([375041, 359861, 398392, 384739, 460181, 478516, 489621, 491401, 515601, 536101, 552601, 558601]);
    expect(l.netWorthChange).toBe(183560);
    expect(l.netWorthChangePct).toBeCloseTo(0.48944, 5);
  });

  it('淨值月成長率', () => {
    expect(l.growth[0]).toBeNull();
    expect(l.growth[1]).toBeCloseTo(-0.0404756, 6);
    expect(l.growth[4]).toBeCloseTo(0.196086, 6);
    expect(l.growth[11]).toBeCloseTo(0.0108577, 6);
  });

  it('儲蓄率 = (收入 − 支出) / 收入', () => {
    expect(l.savingsRate[0]).toBeCloseTo((75000 - 36559) / 75000, 10);
  });

  it('有前一年 12 月淨值時，1 月也能算成長率', () => {
    const l2 = computeLedger(excelBook(), off, 300000);
    expect(l2.growth[0]).toBeCloseTo((375041 - 300000) / 300000, 10);
    expect(l2.netWorthChange).toBe(258601);
  });
});

describe('特殊情況', () => {
  it('分母為 0 回傳 null，不產生 NaN', () => {
    expect(safeDiv(1, 0)).toBeNull();
    expect(safeDiv(0, 0)).toBeNull();
    expect(safeDiv(NaN, 3)).toBeNull();
    expect(safeDiv(1, 4)).toBe(0.25);
  });

  it('全空白年度沒有 NaN', () => {
    const l = computeLedger(emptyYear(2026), off);
    const flat = [...l.netWorth, ...l.growth, ...l.savingsRate, l.netWorthChangePct, ...Object.values(l.itemPct), ...Object.values(l.sectionPct)];
    for (const v of flat) expect(v === null || Number.isFinite(v)).toBe(true);
    expect(l.growth.every((g) => g === null)).toBe(true);
  });

  it('外幣以當月匯率換算，未填匯率沿用上個月', () => {
    const b = emptyYear(2026);
    b.months[0].started = b.months[1].started = b.months[2].started = true;
    b.months[0].values['a-usd'] = 100;
    b.months[1].values['a-usd'] = 100;
    b.months[2].values['a-usd'] = 100;
    b.months[1].rates.USD = 32;
    const l = computeLedger(b, off);
    expect(l.itemValues['a-usd'].slice(0, 3)).toEqual([3137, 3200, 3200]);
  });

  it('開啟負債後淨值再減負債', () => {
    const b = emptyYear(2026);
    b.items.push({ id: 'd-1', section: 'liability', group: '負債', name: '房貸' });
    b.months[0].started = true;
    b.months[0].values['a-bank-a'] = 1000;
    b.months[0].values['e-living'] = 100;
    b.months[0].values['d-1'] = 300;
    expect(computeLedger(b, off).netWorth[0]).toBe(900);
    expect(computeLedger(b, { liabilitiesEnabled: true }).netWorth[0]).toBe(600);
  });

  it('台股、美股資產與利息/股利由股票分頁自動帶入', () => {
    const b = emptyYear(2026);
    b.holdings = [
      { id: 't', code: '2330', name: '台積電', market: 'TW' },
      { id: 'u', code: 'AAPL', name: '蘋果', market: 'US' },
    ];
    const e = b.months[0];
    e.started = true;
    e.shares = { t: 10, u: 2 };
    e.prices = { t: 1000, u: 200 };
    e.cashDiv = { t: 500, u: 10 };
    e.values['i-interest'] = 30;
    e.values['a-stock-tw'] = 999999; // 手動值應被忽略
    const l = computeLedger(b, off);
    expect(l.itemValues['a-stock-tw'][0]).toBe(10000);
    expect(l.itemValues['a-stock-us'][0]).toBeCloseTo(2 * 200 * 31.37, 6);
    expect(l.itemValues['i-interest'][0]).toBeCloseTo(30 + 500 + 10 * 31.37, 6);
  });
});
