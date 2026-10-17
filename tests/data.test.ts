import { describe, expect, it } from 'vitest';
import { backupFileName, parseBackup, toBackup } from '../src/core/backup';
import { createNextYear, prefillMonth, removeHolding, removeItem } from '../src/core/carry';
import { emptyAppData, emptyYear } from '../src/core/defaults';
import { buildReminderIcs } from '../src/core/ics';
import { computeLedger } from '../src/core/ledger';
import { migrate, NewerVersionError } from '../src/core/migrate';
import { sampleAppData } from '../src/core/sample';
import { computeStocks } from '../src/core/stocks';
import { CURRENT_SCHEMA } from '../src/core/types';

describe('帶入上個月', () => {
  it('帶入資產、固定項目、持股、成本與匯率，不帶入一次性項目', () => {
    const b = emptyYear(2026);
    b.holdings = [{ id: 't', code: '2330', name: '台積電', market: 'TW' }];
    const jan = b.months[0];
    jan.started = true;
    jan.rates.USD = 32.5;
    jan.values = { 'a-bank-a': 1000, 'i-salary': 500, 'i-bonus': 9999, 'e-phone': 399, 'e-living': 123, 'i-interest': 7 };
    jan.shares.t = 10;
    jan.prices.t = 900;
    jan.stock.TW = { cost: 8000, sell: 111, buy: 100, fee: 5 };
    jan.cashDiv.t = 50;
    jan.notes['i-other'] = '中發票';

    prefillMonth(b, 1);
    const feb = b.months[1];
    expect(feb.started).toBe(true);
    expect(feb.values).toEqual({ 'a-bank-a': 1000, 'i-salary': 500, 'e-phone': 399 });
    expect(feb.rates.USD).toBe(32.5);
    expect(feb.rates.JPY).toBe(0.2);
    expect(feb.shares.t).toBe(10);
    expect(feb.prices.t).toBe(900);
    expect(feb.stock.TW).toEqual({ cost: 8000 });
    expect(feb.cashDiv).toEqual({});
    expect(feb.notes).toEqual({});
  });

  it('已開始填寫的月份不會被覆蓋', () => {
    const b = emptyYear(2026);
    b.months[0].started = true;
    b.months[0].values['a-bank-a'] = 1000;
    b.months[1].started = true;
    b.months[1].values['a-bank-a'] = 5;
    prefillMonth(b, 1);
    expect(b.months[1].values['a-bank-a']).toBe(5);
  });

  it('新年度帶入帳戶、持股、12 月匯率，1 月帶入去年 12 月數值', () => {
    const prev = emptyYear(2026);
    prev.items[0].name = '我的銀行';
    prev.holdings = [{ id: 't', code: '2330', name: '台積電', market: 'TW' }];
    prev.months[11].started = true;
    prev.months[11].rates.USD = 33;
    prev.months[11].values['a-bank-a'] = 777;
    prev.months[11].shares.t = 3;
    const next = createNextYear(prev);
    expect(next.year).toBe(2027);
    expect(next.items[0].name).toBe('我的銀行');
    expect(next.holdings).toHaveLength(1);
    expect(next.baseRates.USD).toBe(33);
    expect(next.months.every((m) => !m.started)).toBe(true);
    prefillMonth(next, 0, prev);
    expect(next.months[0].values['a-bank-a']).toBe(777);
    expect(next.months[0].shares.t).toBe(3);
    expect(next.months[0].rates.USD).toBe(33);
  });

  it('刪除項目與持股會一併清掉各月數值', () => {
    const b = emptyYear(2026);
    b.holdings = [{ id: 't', code: '2330', name: '台積電', market: 'TW' }];
    b.months[0].values['a-bank-a'] = 1;
    b.months[0].shares.t = 1;
    removeItem(b, 'a-bank-a');
    removeHolding(b, 't');
    expect(b.items.some((i) => i.id === 'a-bank-a')).toBe(false);
    expect(b.months[0].values).toEqual({});
    expect(b.months[0].shares).toEqual({});
  });
});

describe('資料版本升級', () => {
  it('目前版本的資料原樣通過', () => {
    const d = emptyAppData(2026);
    expect(migrate(d)).toEqual(d);
  });

  it('依序套用每一版的升級步驟，舊資料不遺失', () => {
    const old = { schemaVersion: 1, years: { 2026: { year: 2026, items: [{ id: 'a', section: 'asset', group: 'g', name: '舊帳戶' }], months: [{ values: { a: 5 } }] } }, settings: { fillDay: 7 } };
    const steps = {
      1: (d: any) => ({ ...d, addedInV2: true }),
      2: (d: any) => {
        for (const y of Object.values<any>(d.years)) for (const i of y.items) i.name = i.name + '★';
        return d;
      },
    };
    const out: any = migrate(old, steps, 3);
    expect(out.schemaVersion).toBe(3);
    expect(out.addedInV2).toBe(true);
    expect(out.years[2026].items[0].name).toBe('舊帳戶★');
    expect(out.years[2026].months).toHaveLength(12);
    expect(out.years[2026].months[0].values.a).toBe(5);
    expect(out.years[2026].months[5].stock).toEqual({ TW: {}, US: {} });
    expect(out.settings.fillDay).toBe(7);
    expect(out.settings.liabilitiesEnabled).toBe(false);
  });

  it('第 1 版資料升級到第 2 版：補上備註欄位，原有數值不變', () => {
    const v1: any = structuredClone(emptyAppData(2026));
    v1.schemaVersion = 1;
    for (const m of v1.years[2026].months) delete m.notes;
    v1.years[2026].months[0].values['a-bank-a'] = 123;
    const out = migrate(v1);
    expect(out.schemaVersion).toBe(2);
    expect(out.years[2026].months[0].values['a-bank-a']).toBe(123);
    expect(out.years[2026].months.every((m) => typeof m.notes === 'object')).toBe(true);
  });

  it('比網頁新的資料版本會被拒絕，不會被弄壞', () => {
    expect(() => migrate({ schemaVersion: CURRENT_SCHEMA + 1, years: {} })).toThrow(NewerVersionError);
  });

  it('缺少升級步驟時報錯', () => {
    expect(() => migrate({ schemaVersion: 1, years: {} }, {}, 2)).toThrow();
  });
});

describe('備份與還原', () => {
  it('匯出再匯入後資料完全相同，且不含密碼鎖', () => {
    const d = sampleAppData(2026);
    d.settings.lock = { salt: 'aa', hash: 'bb', iterations: 1 };
    const text = JSON.stringify(toBackup(d, new Date(2026, 9, 4)));
    const { data, summary } = parseBackup(text);
    const { lock, ...rest } = d.settings;
    expect(lock).toBeDefined();
    expect(data).toEqual({ ...d, settings: rest });
    expect(summary.years[0].year).toBe(2026);
    expect(summary.years[0].completedMonths).toBe(12);
    expect(summary.years[0].holdings).toBe(9);
    expect(backupFileName(new Date(2026, 9, 4))).toBe('滿月記帳備份_2026-10-04.json');
  });

  it('拒絕不是本網頁的檔案', () => {
    expect(() => parseBackup('not json')).toThrow('無法讀取');
    expect(() => parseBackup('{"foo":1}')).toThrow('不是滿月記帳');
  });
});

describe('範例資料', () => {
  it('可正常計算且沒有 NaN', () => {
    const d = sampleAppData(2026);
    const b = d.years[2026];
    const l = computeLedger(b, d.settings);
    const s = computeStocks(b);
    expect(l.netWorth.every(Number.isFinite)).toBe(true);
    expect(s.totalValue.every((v) => v > 0)).toBe(true);
    // 成本依 Excel 的比例換算，獲利率應與原範例一致
    expect(s.market.TW.plRate[0]).toBeCloseTo(0.186624, 4);
    expect(l.sectionTotal.expense).toBe(562544);
  });
});

describe('行事曆提醒', () => {
  it('每月指定日重複', () => {
    const ics = buildReminderIcs(5, new Date(2026, 9, 4));
    expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=5');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261005');
  });
  it('月底', () => {
    const ics = buildReminderIcs(31, new Date(2026, 1, 10));
    expect(ics).toContain('BYMONTHDAY=-1');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260228');
  });
});
