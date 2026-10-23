import { describe, expect, it } from 'vitest';
import { parseRates, rateTargetDate } from '../src/data/fx';
import { findByCode, norm, searchSecurities } from '../src/data/securities';
import type { SecurityDb } from '../src/data/securities';

describe('匯率日期：填寫當天，不超過該月最後一天', () => {
  const today = new Date(2026, 9, 23);
  it('填當月用今天', () => expect(rateTargetDate(2026, 9, today)).toBe('2026-10-23'));
  it('補填過去月份用該月最後一天', () => {
    expect(rateTargetDate(2026, 6, today)).toBe('2026-07-31');
    expect(rateTargetDate(2026, 1, today)).toBe('2026-02-28');
    expect(rateTargetDate(2025, 11, today)).toBe('2025-12-31');
  });
  it('先填未來月份用今天', () => expect(rateTargetDate(2026, 11, today)).toBe('2026-10-23'));
});

describe('解析匯率', () => {
  it('取倒數換成「1 外幣 ＝ 多少台幣」', () => {
    const r = parseRates({ date: '2026-10-01', twd: { usd: 0.031307, jpy: 4.9566, gbp: 0.023634 } }, ['USD', 'JPY', 'GBP', 'XYZ']);
    expect(r.USD).toBeCloseTo(31.9417, 3);
    expect(r.JPY).toBeCloseTo(0.20175, 4);
    expect(r.GBP).toBeCloseTo(42.312, 2);
    expect(r.XYZ).toBeUndefined();
  });
  it('格式不對時回傳空的', () => expect(parseRates(null, ['USD'])).toEqual({}));
});

const db: SecurityDb = {
  updatedAt: '2026-10-23',
  list: [
    { code: '2330', name: '台積電', market: 'TW' },
    { code: '0050', name: '元大台灣50', market: 'TW' },
    { code: '006208', name: '富邦台50', market: 'TW' },
    { code: '00878', name: '國泰永續高股息', market: 'TW' },
    { code: '2886', name: '兆豐金', market: 'TW' },
    { code: 'TSM', name: 'Taiwan Semiconductor Manufacturing Company Ltd.', market: 'US', alias: '台積電 ADR' },
    { code: 'AAPL', name: 'Apple Inc.', market: 'US', alias: '蘋果' },
    { code: 'APP', name: 'AppLovin Corporation', market: 'US' },
    { code: 'VOO', name: 'Vanguard S&P 500 ETF', market: 'US', alias: '先鋒標普500 ETF' },
  ],
};
const codes = (q: string) => searchSecurities(db, q).map((s) => s.code);

describe('股票搜尋', () => {
  it('用中文名稱找台股，台股排在同名美股 ADR 前面', () => expect(codes('台積')).toEqual(['2330', 'TSM']));
  it('臺／台、全形字都能找到', () => {
    expect(codes('臺積電')[0]).toBe('2330');
    expect(codes('００５０')).toEqual(['0050']);
    expect(norm(' Ａpple ')).toBe('apple');
  });
  it('名稱中間的字也找得到', () => expect(codes('台50')).toEqual(['006208']));
  it('用代碼找，完全相符排第一', () => {
    expect(codes('0050')).toEqual(['0050']);
    expect(codes('app')).toEqual(['APP', 'AAPL']);
    expect(codes('aapl')).toEqual(['AAPL']);
  });
  it('美股可用中文名或英文名', () => {
    expect(codes('蘋果')).toEqual(['AAPL']);
    expect(codes('vanguard')).toEqual(['VOO']);
    expect(codes('標普')).toEqual(['VOO']);
  });
  it('依代碼找完全相符', () => {
    expect(findByCode(db, ' tsm ')?.name).toContain('Taiwan');
    expect(findByCode(db, '2330', 'US')).toBeUndefined();
  });
  it('空白查詢沒有結果', () => expect(codes('  ')).toEqual([]));
});
