import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../src/core/defaults';
import { NewerVersionError } from '../src/core/migrate';
import { sampleAppData } from '../src/core/sample';
import {
  changedUnits,
  firstLinkAction,
  fromCloud,
  mergeSync,
  stampAll,
  stampChanges,
  toCloud,
  unitLabel,
  units,
  withDeviceSettings,
} from '../src/core/sync';
import type { Stamps } from '../src/core/sync';
import { CURRENT_SCHEMA } from '../src/core/types';
import type { AppData } from '../src/core/types';

function base(): AppData {
  const d = emptyAppData(2026);
  d.settings.onboarded = true;
  return d;
}
const edit = (d: AppData, fn: (x: AppData) => void) => {
  const x = structuredClone(d);
  fn(x);
  return x;
};

describe('拆成單位', () => {
  it('共用設定、每年項目設定、每個月各自一個單位', () => {
    const keys = Object.keys(units(base()));
    expect(keys).toContain('settings');
    expect(keys).toContain('2026/config');
    expect(keys).toContain('2026/0');
    expect(keys).toContain('2026/11');
    expect(keys).toHaveLength(1 + 1 + 12);
  });

  it('只有改到的單位會被標記', () => {
    const a = base();
    const b = edit(a, (x) => (x.years[2026].months[9].values['a-bank-a'] = 100));
    expect(changedUnits(a, b)).toEqual(['2026/9']);
    const c = edit(b, (x) => x.years[2026].items.push({ id: 'n', section: 'expense', group: '固定支出', name: '停車費' }));
    expect(changedUnits(b, c)).toEqual(['2026/config']);
  });

  it('裝置專屬設定的變動不算', () => {
    const a = base();
    const b = edit(a, (x) => {
      x.settings.lastBackupAt = new Date().toISOString();
      x.settings.lock = { salt: 'a', hash: 'b', iterations: 1 };
    });
    expect(changedUnits(a, b)).toEqual([]);
    const c = edit(a, (x) => (x.settings.fillDay = 5));
    expect(changedUnits(a, c)).toEqual(['settings']);
  });

  it('記錄修改時間與裝置', () => {
    const a = base();
    const b = edit(a, (x) => (x.years[2026].months[0].values['a-bank-a'] = 1));
    const s = stampChanges({}, a, b, 'phone', 1000);
    expect(s).toEqual({ '2026/0': { t: 1000, d: 'phone' } });
    expect(stampChanges(s, b, b, 'phone', 2000)).toBe(s);
  });
});

describe('合併', () => {
  // 兩台裝置都從同一份同步過的資料出發
  const start = base();
  const synced: Stamps = {};

  it('兩台改不同月份：兩邊的修改都保留', () => {
    const phone = edit(start, (x) => (x.years[2026].months[9].values['a-bank-a'] = 100));
    const pc = edit(start, (x) => (x.years[2026].months[8].values['a-bank-a'] = 90));
    const r = mergeSync(
      { data: phone, stamps: { '2026/9': { t: 20, d: 'phone' } } },
      { data: pc, stamps: { '2026/8': { t: 10, d: 'pc' } } },
      synced,
    );
    expect(r.data.years[2026].months[9].values['a-bank-a']).toBe(100);
    expect(r.data.years[2026].months[8].values['a-bank-a']).toBe(90);
    expect(r.conflicts).toEqual([]);
    expect(r.localChanged).toBe(true);
    expect(r.cloudChanged).toBe(true);
    expect(r.stamps['2026/9'].d).toBe('phone');
    expect(r.stamps['2026/8'].d).toBe('pc');
  });

  it('同一個月兩邊都改：保留較新的，並回報衝突', () => {
    const phone = edit(start, (x) => (x.years[2026].months[9].values['a-bank-a'] = 100));
    const pc = edit(start, (x) => (x.years[2026].months[9].values['a-bank-a'] = 200));
    const r = mergeSync(
      { data: phone, stamps: { '2026/9': { t: 10, d: 'phone' } } },
      { data: pc, stamps: { '2026/9': { t: 30, d: 'pc' } } },
      synced,
    );
    expect(r.data.years[2026].months[9].values['a-bank-a']).toBe(200);
    expect(r.conflicts).toEqual([{ key: '2026/9', kept: 'cloud', keptStamp: { t: 30, d: 'pc' } }]);
    expect(r.cloudChanged).toBe(false);
  });

  it('只有一邊改過（另一邊停在上次同步）不算衝突', () => {
    const synced2: Stamps = { '2026/9': { t: 5, d: 'pc' } };
    const pc = edit(start, (x) => (x.years[2026].months[9].values['a-bank-a'] = 1));
    const phone = edit(start, (x) => (x.years[2026].months[9].values['a-bank-a'] = 2));
    const r = mergeSync({ data: pc, stamps: synced2 }, { data: phone, stamps: { '2026/9': { t: 9, d: 'phone' } } }, synced2);
    expect(r.conflicts).toEqual([]);
    expect(r.data.years[2026].months[9].values['a-bank-a']).toBe(2);
  });

  it('時間相同時以雲端為準', () => {
    const a = edit(start, (x) => (x.years[2026].months[0].values['a-bank-a'] = 1));
    const b = edit(start, (x) => (x.years[2026].months[0].values['a-bank-a'] = 2));
    const st = { '2026/0': { t: 7, d: 'x' } };
    expect(mergeSync({ data: a, stamps: st }, { data: b, stamps: st }, {}).data.years[2026].months[0].values['a-bank-a']).toBe(2);
  });

  it('只有雲端有的年度會被建立；只有這台有的年度會上傳', () => {
    const cloud = edit(start, (x) => {
      x.years[2027] = structuredClone(x.years[2026]);
      x.years[2027].year = 2027;
      x.years[2027].months[0].values['a-bank-a'] = 5;
    });
    const r = mergeSync({ data: start, stamps: {} }, { data: cloud, stamps: { '2027/0': { t: 3, d: 'pc' } } }, {});
    expect(r.data.years[2027].months[0].values['a-bank-a']).toBe(5);
    expect(r.data.years[2027].items.length).toBe(start.years[2026].items.length);
    const r2 = mergeSync({ data: cloud, stamps: {} }, { data: start, stamps: {} }, {});
    expect(r2.cloudChanged).toBe(true);
    expect(r2.data.years[2027]).toBeDefined();
  });

  it('合併不會改掉這台裝置的密碼鎖與備份日期', () => {
    const local = edit(start, (x) => {
      x.settings.lock = { salt: 's', hash: 'h', iterations: 1 };
      x.settings.lastBackupAt = '2026-10-01T00:00:00.000Z';
    });
    const cloud = edit(start, (x) => (x.settings.fillDay = 9));
    const r = mergeSync({ data: local, stamps: {} }, { data: cloud, stamps: { settings: { t: 1, d: 'pc' } } }, {});
    expect(r.data.settings.fillDay).toBe(9);
    expect(r.data.settings.lock).toEqual({ salt: 's', hash: 'h', iterations: 1 });
    expect(r.data.settings.lastBackupAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('內容相同就不需要上傳或更新', () => {
    const r = mergeSync({ data: start, stamps: {} }, { data: structuredClone(start), stamps: {} }, {});
    expect(r.localChanged).toBe(false);
    expect(r.cloudChanged).toBe(false);
  });
});

describe('雲端檔案', () => {
  it('上傳時拿掉密碼鎖等裝置專屬設定，下載後可還原資料', () => {
    const d = sampleAppData(2026);
    d.settings = { ...d.settings, isSample: false, lock: { salt: 'a', hash: 'b', iterations: 1 }, lastBackupAt: 'x', fillDay: 12 };
    const doc = toCloud(d, stampAll(d, 'pc', 1), 'pc');
    const text = JSON.stringify(doc);
    expect(text).not.toContain('"lock"');
    expect(text).not.toContain('lastBackupAt');
    const back = fromCloud(text);
    expect(back.data.years).toEqual(d.years);
    expect(back.data.settings.fillDay).toBe(12);
    expect(Object.keys(back.stamps)).toHaveLength(14);
  });

  it('雲端資料版本比網頁新時拒絕，不會覆蓋', () => {
    const doc = toCloud(base(), {}, 'pc');
    doc.data.schemaVersion = CURRENT_SCHEMA + 1;
    expect(() => fromCloud(JSON.stringify(doc))).toThrow(NewerVersionError);
  });

  it('不是本網頁的檔案會報錯', () => {
    expect(() => fromCloud('{"app":"other"}')).toThrow('格式不正確');
  });

  it('套用雲端資料時保留這台的裝置設定', () => {
    const cloud = edit(base(), (x) => (x.settings.fillDay = 3));
    const device = { ...base().settings, lock: { salt: 'a', hash: 'b', iterations: 1 }, onboarded: false };
    const out = withDeviceSettings(cloud, device);
    expect(out.settings.fillDay).toBe(3);
    expect(out.settings.lock).toBeDefined();
    expect(out.settings.onboarded).toBe(true);
  });
});

describe('第一次連結', () => {
  it('雲端沒資料：上傳；這台沒資料：下載；兩邊都有：讓使用者選', () => {
    expect(firstLinkAction(base(), false)).toBe('upload');
    expect(firstLinkAction(emptyAppData(2026), true)).toBe('download');
    expect(firstLinkAction(sampleAppData(2026), true)).toBe('download');
    expect(firstLinkAction(base(), true)).toBe('choose');
  });

  it('單位名稱', () => {
    expect(unitLabel('2026/9')).toBe('2026 年 10 月');
    expect(unitLabel('2026/config')).toBe('2026 年的項目設定');
    expect(unitLabel('settings')).toBe('共用設定');
  });
});
