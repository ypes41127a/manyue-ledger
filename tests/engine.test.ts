import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../src/core/defaults';
import { sampleAppData } from '../src/core/sample';
import type { AppData } from '../src/core/types';
import type { SyncMeta } from '../src/db/db';
import { withStamps } from '../src/db/state';
import type { State } from '../src/db/state';
import type { DriveApi } from '../src/sync/drive';
import { BACKUP_PREFIX, deleteCloudData, linkDevice, MAIN_FILE, resolveChoice, syncOnce } from '../src/sync/engine';
import type { EngineDeps } from '../src/sync/engine';

/** 記憶體中的雲端硬碟 */
function memoryDrive() {
  const files = new Map<string, { name: string; text: string }>();
  let seq = 0;
  const drive: DriveApi & { files: typeof files; beforeRead?: () => void } = {
    files,
    list: async (prefix) => [...files].filter(([, f]) => f.name.startsWith(prefix)).map(([id, f]) => ({ id, name: f.name })),
    read: async (id) => {
      drive.beforeRead?.();
      return files.get(id)!.text;
    },
    create: async (name, text) => {
      const id = `f${++seq}`;
      files.set(id, { name, text });
      return id;
    },
    update: async (id, text) => void (files.get(id)!.text = text),
    remove: async (id) => void files.delete(id),
  };
  return drive;
}

let clock = 1_000_000;
const tick = () => new Date((clock += 1000));

/** 模擬一台裝置：和正式程式一樣的修改記錄方式 */
function device(name: string, drive: DriveApi, data: AppData = emptyAppData(2026)) {
  const meta: SyncMeta = { deviceId: name, stamps: {}, synced: {}, linked: false, dirty: false };
  let state: State = { data, meta };
  const snapshots: AppData[] = [];
  const deps: EngineDeps = {
    drive,
    now: tick,
    getState: () => state,
    apply: (d, m) => (state = { data: d ?? state.data, meta: { ...state.meta, ...m } }),
    snapshot: async (d) => void snapshots.push(d),
  };
  return {
    deps,
    snapshots,
    get state() {
      return state;
    },
    edit(fn: (d: AppData) => void) {
      const draft = structuredClone(state.data);
      fn(draft);
      state = withStamps(state, draft, tick().getTime());
    },
    replace(d: AppData) {
      state = withStamps(state, d, tick().getTime());
    },
  };
}

function setupDone(): AppData {
  const d = emptyAppData(2026);
  d.settings.onboarded = true;
  return d;
}
const bank = (s: State, m: number) => s.data.years[2026].months[m].values['a-bank-a'];

describe('兩台裝置同步', () => {
  it('電腦先上傳，手機登入後取得資料，雙方的修改都會同步', async () => {
    const drive = memoryDrive();
    const pc = device('pc', drive, setupDone());
    pc.edit((d) => (d.years[2026].months[9].values['a-bank-a'] = 1000));
    expect(await linkDevice(pc.deps, 'me@x.com')).toEqual({ kind: 'linked', how: 'upload' });
    expect(pc.state.meta.linked).toBe(true);

    const phone = device('phone', drive);
    expect(await linkDevice(phone.deps, 'me@x.com')).toEqual({ kind: 'linked', how: 'download' });
    expect(bank(phone.state, 9)).toBe(1000);
    expect(phone.state.data.settings.onboarded).toBe(true);

    phone.edit((d) => (d.years[2026].months[9].values['a-bank-b'] = 50));
    expect(phone.state.meta.dirty).toBe(true);
    expect(await syncOnce(phone.deps)).toMatchObject({ pushed: true, pulled: false });
    expect(phone.state.meta.dirty).toBe(false);

    pc.edit((d) => (d.years[2026].months[8].values['a-bank-a'] = 900));
    const r = await syncOnce(pc.deps);
    expect(r).toMatchObject({ pulled: true, pushed: true, conflicts: [] });
    expect(pc.state.data.years[2026].months[9].values['a-bank-b']).toBe(50);
    expect(pc.snapshots).toHaveLength(1);

    await syncOnce(phone.deps);
    expect(bank(phone.state, 8)).toBe(900);
  });

  it('同一個月兩台都改：保留較晚修改的版本並回報', async () => {
    const drive = memoryDrive();
    const pc = device('pc', drive, setupDone());
    await linkDevice(pc.deps, 'me');
    const phone = device('phone', drive);
    await linkDevice(phone.deps, 'me');

    pc.edit((d) => (d.years[2026].months[9].values['a-bank-a'] = 1));
    phone.edit((d) => (d.years[2026].months[9].values['a-bank-a'] = 2));
    await syncOnce(pc.deps);
    const r = await syncOnce(phone.deps);
    expect(r.conflicts.map((c) => c.key)).toEqual(['2026/9']);
    expect(bank(phone.state, 9)).toBe(2);
    await syncOnce(pc.deps);
    expect(bank(pc.state, 9)).toBe(2);
  });

  it('同步途中使用者有輸入：不會蓋掉，重新合併', async () => {
    const drive = memoryDrive();
    const pc = device('pc', drive, setupDone());
    await linkDevice(pc.deps, 'me');
    const phone = device('phone', drive);
    await linkDevice(phone.deps, 'me');
    pc.edit((d) => (d.years[2026].months[0].values['a-bank-a'] = 10));
    await syncOnce(pc.deps);

    let once = true;
    drive.beforeRead = () => {
      if (once) phone.edit((d) => (d.years[2026].months[1].values['a-bank-a'] = 20));
      once = false;
    };
    await syncOnce(phone.deps);
    drive.beforeRead = undefined;
    expect(bank(phone.state, 0)).toBe(10);
    expect(bank(phone.state, 1)).toBe(20);
    await syncOnce(pc.deps);
    expect(bank(pc.state, 1)).toBe(20);
  });

  it('沒有變動時不會上傳', async () => {
    const drive = memoryDrive();
    const pc = device('pc', drive, setupDone());
    await linkDevice(pc.deps, 'me');
    const before = [...drive.files.values()][0].text;
    expect(await syncOnce(pc.deps)).toMatchObject({ pushed: false, pulled: false });
    expect([...drive.files.values()][0].text).toBe(before);
  });
});

describe('第一次連結時兩邊都有資料', () => {
  async function both() {
    const drive = memoryDrive();
    const pc = device('pc', drive, setupDone());
    pc.edit((d) => (d.years[2026].months[0].values['a-bank-a'] = 111));
    await linkDevice(pc.deps, 'me');
    const phone = device('phone', drive, setupDone());
    phone.edit((d) => (d.years[2026].months[0].values['a-bank-a'] = 222));
    const r = await linkDevice(phone.deps, 'me');
    if (r.kind !== 'choose') throw new Error('expected choose');
    return { drive, pc, phone, r };
  }

  it('讓使用者選，並列出兩邊摘要', async () => {
    const { r } = await both();
    expect(r.local.years[0].year).toBe(2026);
    expect(r.cloud.years[0].year).toBe(2026);
  });

  it('選雲端：這台先留快照再改用雲端資料', async () => {
    const { phone, r } = await both();
    await resolveChoice(phone.deps, 'me', 'cloud', r.cloudState);
    expect(bank(phone.state, 0)).toBe(111);
    expect(phone.snapshots).toHaveLength(1);
    expect(phone.state.meta.linked).toBe(true);
  });

  it('選這台：雲端先備份再覆蓋，另一台同步後跟著更新', async () => {
    const { drive, pc, phone, r } = await both();
    await resolveChoice(phone.deps, 'me', 'local', r.cloudState);
    expect((await drive.list(BACKUP_PREFIX)).length).toBe(1);
    await syncOnce(pc.deps);
    expect(bank(pc.state, 0)).toBe(222);
  });
});

describe('安全保護', () => {
  it('清除資料會解除連結，不會把空白資料同步出去', async () => {
    const drive = memoryDrive();
    const pc = device('pc', drive, setupDone());
    pc.edit((d) => (d.years[2026].months[0].values['a-bank-a'] = 5));
    await linkDevice(pc.deps, 'me');
    pc.replace(emptyAppData(2026));
    expect(pc.state.meta.linked).toBe(false);
    expect(pc.state.meta.dirty).toBe(false);
    const phone = device('phone', drive);
    await linkDevice(phone.deps, 'me');
    expect(bank(phone.state, 0)).toBe(5);
  });

  it('從歡迎頁取回資料但雲端沒有資料：不建立連結', async () => {
    const drive = memoryDrive();
    const phone = device('phone', drive);
    expect(await linkDevice(phone.deps, 'me', true)).toEqual({ kind: 'no-cloud' });
    expect(phone.state.meta.linked).toBe(false);
    expect(drive.files.size).toBe(0);
  });

  it('範例資料視為沒有資料，登入後直接下載', async () => {
    const drive = memoryDrive();
    const pc = device('pc', drive, setupDone());
    await linkDevice(pc.deps, 'me');
    const phone = device('phone', drive, sampleAppData(2026));
    expect(await linkDevice(phone.deps, 'me')).toEqual({ kind: 'linked', how: 'download' });
    expect(phone.state.data.settings.isSample).toBe(false);
  });

  it('雲端檔案被刪除後再同步：用這台的資料重建', async () => {
    const drive = memoryDrive();
    const pc = device('pc', drive, setupDone());
    pc.edit((d) => (d.years[2026].months[0].values['a-bank-a'] = 7));
    await linkDevice(pc.deps, 'me');
    await deleteCloudData(drive);
    expect(drive.files.size).toBe(0);
    expect(await syncOnce(pc.deps)).toMatchObject({ pushed: true });
    expect((await drive.list(MAIN_FILE)).length).toBe(1);
  });

  it('密碼鎖不會上傳到雲端', async () => {
    const drive = memoryDrive();
    const pc = device('pc', drive, setupDone());
    pc.edit((d) => (d.settings.lock = { salt: 's', hash: 'h', iterations: 1 }));
    await linkDevice(pc.deps, 'me');
    expect([...drive.files.values()][0].text).not.toContain('"lock"');
  });
});
