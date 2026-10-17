import { useEffect, useRef, useState } from 'react';
import { parseBackup } from '../core/backup';
import type { BackupSummary } from '../core/backup';
import { createNextYear } from '../core/carry';
import { emptyAppData } from '../core/defaults';
import { buildReminderIcs } from '../core/ics';
import { createLock } from '../core/lock';
import { SECTION_LABEL } from '../core/types';
import type { AppData, Section } from '../core/types';
import { useStore } from '../db/store';
import { exportBackup } from './actions';
import { CurrencyEditor, FillDayPicker, HoldingsEditor, ItemsEditor } from './editors';
import { daysSince, fmtDate, fmtMoney } from './format';
import { Button, Card, downloadBlob, Modal, Segmented } from './kit';

export function SettingsPage() {
  const { data, year, years, update, replace, setYear } = useStore();
  const [section, setSection] = useState<Section>('asset');
  const [pending, setPending] = useState<{ data: AppData; summary: BackupSummary } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lockOpen, setLockOpen] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const s = data.settings;
  const maxYear = years[years.length - 1];

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPending(parseBackup(await f.text()));
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '無法讀取這個檔案');
    }
    if (file.current) file.current.value = '';
  };
  const confirmImport = () => {
    if (!pending) return;
    // 密碼鎖屬於這台裝置，還原時保留目前的設定
    replace({ ...pending.data, settings: { ...pending.data.settings, lock: s.lock, lastBackupAt: pending.summary.exportedAt || s.lastBackupAt } });
    setPending(null);
    setMessage('已還原備份資料');
  };
  const exportExcel = async () => {
    setBusy(true);
    try {
      const { buildExcel } = await import('../export/excel');
      downloadBlob(`滿月記帳表_${new Date().toISOString().slice(0, 10)}.xlsx`, await buildExcel(data));
    } catch (e) {
      setMessage('匯出 Excel 失敗：' + (e instanceof Error ? e.message : String(e)));
    }
    setBusy(false);
  };
  const sections: Section[] = ['asset', 'income', 'expense', 'invest', ...(s.liabilitiesEnabled ? (['liability'] as const) : [])];
  const days = daysSince(s.lastBackupAt);

  return (
    <div className="space-y-4">
      {message && <div className="rounded-2xl bg-sunken px-4 py-3 text-sm" role="status">{message}</div>}

      <Card title="備份與還原">
        <p className="text-sm text-ink2">
          上次備份：{fmtDate(s.lastBackupAt)}
          {days !== null && `（${days} 天前）`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => exportBackup(data, update)}>匯出備份</Button>
          <Button onClick={() => file.current?.click()}>匯入備份</Button>
          <Button onClick={exportExcel} disabled={busy}>{busy ? '產生中…' : '匯出 Excel'}</Button>
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        <p className="mt-3 text-xs text-muted">備份檔是 JSON 格式，請存到雲端硬碟或傳給自己。Excel 檔只供查看，無法匯入回來。</p>
      </Card>

      <Card title="資料存放說明">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink2">
          <li>資料<b className="text-ink">只存在這台裝置的這個瀏覽器</b>，不會上傳，也沒有帳號可以登入找回。</li>
          <li>換手機、換電腦或換瀏覽器時，請先「匯出備份」，再到新的地方「匯入備份」。</li>
          <li>清除瀏覽器資料、解除安裝瀏覽器，或 iPhone Safari 太久沒開，資料都可能消失。</li>
        </ul>
        <p className="mt-2 text-xs text-muted">
          永久儲存狀態：{persisted === null ? '這個瀏覽器不支援查詢' : persisted ? '已啟用（瀏覽器不會自動清除）' : '未啟用（把網頁加入主畫面或安裝成 App 後通常會啟用）'}
        </p>
      </Card>

      <Card title="每月填寫日與提醒">
        <FillDayPicker />
        <div className="mt-3">
          <Button onClick={() => downloadBlob('滿月記帳提醒.ics', new Blob([buildReminderIcs(s.fillDay)], { type: 'text/calendar' }))}>下載行事曆提醒（.ics）</Button>
        </div>
        <p className="mt-2 text-xs text-muted">下載後打開檔案，加入手機或電腦的行事曆，每個月會自動提醒。改了填寫日要重新下載，並自行刪除舊的提醒。</p>
      </Card>

      <Card title={`記帳項目（${year} 年）`}>
        <div className="mb-3 overflow-x-auto">
          <Segmented value={section} onChange={setSection} options={sections.map((x) => ({ value: x, label: SECTION_LABEL[x] }))} />
        </div>
        <ItemsEditor key={section} section={section} />
        <p className="mt-3 text-xs text-muted">改名與排序不會影響已填的數字。項目設定以年度為單位，這裡修改的是 {year} 年。</p>
      </Card>

      <Card title={`持股（${year} 年）`}>
        <HoldingsEditor />
      </Card>

      <Card title="外幣與匯率">
        <CurrencyEditor />
      </Card>

      <Card title="負債區塊">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-5" checked={s.liabilitiesEnabled} onChange={(e) => update((d) => (d.settings.liabilitiesEnabled = e.target.checked))} />
          <span>
            記錄負債餘額（房貸、信貸、學貸等）
            <span className="block text-xs text-muted">開啟後每月填寫各項負債的剩餘金額，個人淨值會再減去負債總計。開啟後請到上方「記帳項目 → 負債」新增項目。</span>
          </span>
        </label>
      </Card>

      <Card title="年度">
        <p className="text-sm text-ink2">目前有：{years.map((y) => `${y} 年`).join('、')}</p>
        <div className="mt-3">
          <Button
            onClick={() => {
              update((d) => (d.years[maxYear + 1] = createNextYear(d.years[maxYear])));
              setYear(maxYear + 1);
              setMessage(`已建立 ${maxYear + 1} 年度，並帶入 ${maxYear} 年的帳戶、持股與匯率`);
            }}
          >
            建立 {maxYear + 1} 年度
          </Button>
        </div>
      </Card>

      <Card title="密碼鎖">
        <p className="text-sm text-ink2">給共用裝置的人使用：開啟網頁時需要輸入密碼。{s.lock ? '目前已開啟。' : '目前未開啟。'}</p>
        <p className="mt-2 rounded-xl bg-warnbg px-3 py-2 text-sm text-warnink">忘記密碼無法找回，只能清除資料後用備份檔還原。開啟前請先匯出備份。密碼鎖只是擋住畫面，資料本身沒有加密。</p>
        <div className="mt-3 flex gap-2">
          {s.lock ? <Button variant="danger" onClick={() => update((d) => delete d.settings.lock)}>關閉密碼鎖</Button> : <Button onClick={() => setLockOpen(true)}>設定密碼</Button>}
        </div>
      </Card>

      <Card title="清除資料">
        {s.isSample && <p className="mb-2 text-sm text-ink2">目前是範例資料。清除後會回到首次使用畫面，讓你從空白開始設定。</p>}
        <Button variant="danger" onClick={() => window.confirm(s.isSample ? '確定清除範例資料？' : '確定清除這台裝置上的所有記帳資料嗎？請先確認已匯出備份，這個動作無法復原。') && replace(emptyAppData(new Date().getFullYear()))}>
          {s.isSample ? '清除範例資料' : '清除全部資料'}
        </Button>
      </Card>

      <p className="pb-4 text-center text-xs text-muted">滿月記帳法由柴鼠兄弟開發・版本 {__APP_VERSION__}</p>

      {pending && (
        <Modal title="確認匯入備份" onClose={() => setPending(null)}>
          <p className="text-sm text-ink2">備份日期：<b className="text-ink">{fmtDate(pending.summary.exportedAt)}</b></p>
          <ul className="mt-2 space-y-1 text-sm text-ink2">
            {pending.summary.years.map((y) => (
              <li key={y.year} className="rounded-xl bg-sunken px-3 py-2">
                <b className="text-ink">{y.year} 年</b>：已完成 {y.completedMonths} 個月、{y.items} 個項目、{y.holdings} 檔持股
                {y.netWorth !== null && <>、最新淨值 {fmtMoney(y.netWorth)}</>}
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-xl bg-warnbg px-3 py-2 text-sm text-warnink">匯入後會<b>取代</b>這台裝置目前的所有記帳資料。</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setPending(null)}>取消</Button>
            <Button variant="primary" onClick={confirmImport}>確認匯入</Button>
          </div>
        </Modal>
      )}
      {lockOpen && <LockModal onClose={() => setLockOpen(false)} />}
    </div>
  );
}

function LockModal({ onClose }: { onClose: () => void }) {
  const { update } = useStore();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const ok = a.length >= 4 && a === b;
  const input = 'h-11 w-full rounded-xl border border-line bg-surface px-3';
  return (
    <Modal title="設定密碼" onClose={onClose}>
      <div className="space-y-3">
        <input type="password" aria-label="新密碼" placeholder="新密碼（至少 4 個字）" className={input} value={a} onChange={(e) => setA(e.target.value)} />
        <input type="password" aria-label="再輸入一次" placeholder="再輸入一次" className={input} value={b} onChange={(e) => setB(e.target.value)} />
        {b !== '' && a !== b && <p className="text-sm text-danger">兩次輸入不一樣</p>}
        <p className="text-sm text-warnink">忘記密碼只能清除資料、用備份檔還原。</p>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={!ok}
            onClick={async () => {
              const lock = await createLock(a);
              update((d) => (d.settings.lock = lock));
              onClose();
            }}
          >
            開啟密碼鎖
          </Button>
        </div>
      </div>
    </Modal>
  );
}
