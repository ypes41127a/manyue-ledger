import { useEffect, useState } from 'react';
import type { BackupSummary } from '../core/backup';
import { unitLabel } from '../core/sync';
import { listSnapshots, loadSnapshot } from '../db/db';
import { useStore } from '../db/store';
import { useSync } from '../sync/SyncProvider';
import type { SyncStatus } from '../sync/SyncProvider';
import { daysSince, fmtDate, fmtMoney } from './format';
import { Banner, Button, Card, Modal } from './kit';

function ago(iso: string | undefined): string {
  if (!iso) return '尚未同步';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return '剛剛';
  if (mins < 60) return `${mins} 分鐘前`;
  const days = daysSince(iso) ?? 0;
  if (days < 1) return `${Math.floor(mins / 60)} 小時前`;
  return fmtDate(iso);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  off: '未同步',
  'needs-auth': '點此同步',
  syncing: '同步中…',
  ok: '已同步',
  error: '同步失敗',
};

/** 頂部的同步狀態小按鈕（已連結雲端時才顯示） */
export function SyncChip() {
  const { meta } = useStore();
  const sync = useSync();
  if (!sync.available || !meta.linked) return null;
  const s = sync.status;
  const label = s === 'ok' && meta.dirty ? '有變更待同步' : STATUS_TEXT[s];
  return (
    <button
      type="button"
      onClick={() => void sync.connect()}
      disabled={s === 'syncing'}
      title={meta.lastSyncAt ? `上次同步：${ago(meta.lastSyncAt)}` : undefined}
      className={`h-9 shrink-0 rounded-lg px-2 text-xs ${s === 'needs-auth' || s === 'error' ? 'bg-white font-medium text-brand' : 'border border-white/30 text-white/90'}`}
    >
      ☁ {label}
    </button>
  );
}

/** 同步相關的提示：衝突、錯誤、第一次連結時的選擇 */
export function SyncNotices() {
  const { meta } = useStore();
  const sync = useSync();
  if (!sync.available) return null;
  return (
    <>
      {meta.linked && sync.status === 'needs-auth' && (
        <Banner tone="info" action={<Button variant="primary" onClick={() => void sync.connect()}>同步</Button>}>
          已連結雲端（{meta.email}）。點「同步」取得其他裝置的最新資料。
        </Banner>
      )}
      {sync.message && (
        <Banner action={sync.status === 'error' ? <Button onClick={() => void sync.connect()}>再試一次</Button> : undefined}>{sync.message}</Banner>
      )}
      {sync.conflicts.length > 0 && (
        <Banner tone="info" action={<Button variant="ghost" onClick={sync.dismissConflicts}>知道了</Button>}>
          以下資料在兩台裝置都有修改，已採用較晚修改的版本：
          <ul className="mt-1 list-disc pl-5">
            {sync.conflicts.map((c) => (
              <li key={c.key}>
                {unitLabel(c.key)}（{c.kept === 'local' ? '這台裝置' : '另一台裝置'}，{fmtTime(new Date(c.keptStamp.t).toISOString())}）
              </li>
            ))}
          </ul>
          若結果不對，可到「設定 → 雲端同步 → 還原同步前的資料」救回。
        </Banner>
      )}
      {sync.choice && <ChoiceModal />}
    </>
  );
}

function SummaryBox({ title, s }: { title: string; s: BackupSummary }) {
  return (
    <div className="rounded-xl bg-sunken px-3 py-2 text-sm text-ink2">
      <div className="font-semibold text-ink">{title}</div>
      {s.years.map((y) => (
        <div key={y.year}>
          {y.year} 年：已完成 {y.completedMonths} 個月、{y.items} 個項目
          {y.netWorth !== null && <>、最新淨值 {fmtMoney(y.netWorth)}</>}
        </div>
      ))}
    </div>
  );
}

function ChoiceModal() {
  const sync = useSync();
  const c = sync.choice!;
  return (
    <Modal title="雲端和這台裝置都有資料" onClose={sync.cancelChoice}>
      <p className="text-sm text-ink2">請選擇要以哪一份為準。另一份不會消失，會先自動備份。</p>
      <div className="mt-3 space-y-2">
        <SummaryBox title={`雲端（${fmtDate(c.cloud.exportedAt)} 更新）`} s={c.cloud} />
        <SummaryBox title="這台裝置" s={c.local} />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="primary" onClick={() => void c.resolve('cloud')}>使用雲端的資料</Button>
        <Button onClick={() => void c.resolve('local')}>使用這台的資料（覆蓋雲端）</Button>
        <Button variant="ghost" onClick={sync.cancelChoice}>取消，先不要同步</Button>
      </div>
    </Modal>
  );
}

/** 設定頁的雲端同步區塊 */
export function SyncCard() {
  const { data, meta, replace } = useStore();
  const sync = useSync();
  const [snaps, setSnaps] = useState<string[]>([]);
  const [showSnaps, setShowSnaps] = useState(false);

  useEffect(() => {
    if (showSnaps) void listSnapshots().then(setSnaps);
  }, [showSnaps, meta.lastSyncAt]);

  if (!sync.available) return null;

  if (!meta.linked) {
    return (
      <Card title="雲端同步">
        <p className="text-sm text-ink2">用 Google 帳號登入後，手機和電腦可以共用同一份記帳資料。</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink2">
          <li>資料存在<b className="text-ink">你自己的 Google 雲端硬碟</b>中本網頁專屬的隱藏資料夾，網站開發者看不到。</li>
          <li>本網頁只能存取這個專屬資料夾，看不到你雲端硬碟裡的其他檔案。</li>
          <li>不登入也可以繼續使用，資料只存在這台裝置。</li>
        </ul>
        {data.settings.isSample ? (
          <p className="mt-3 text-sm text-warnink">目前是範例資料。請先清除範例、完成自己的設定後再登入。</p>
        ) : (
          <Button variant="primary" className="mt-3" onClick={() => void sync.connect()} disabled={sync.status === 'syncing'}>
            {sync.status === 'syncing' ? '連線中…' : '用 Google 登入並同步'}
          </Button>
        )}
        <p className="mt-2 text-xs text-muted">
          詳見 <a className="text-accent underline" href="./privacy.html" target="_blank" rel="noreferrer">隱私權政策</a>。
        </p>
      </Card>
    );
  }

  return (
    <Card title="雲端同步">
      <p className="text-sm text-ink2">
        已連結：<b className="text-ink">{meta.email || 'Google 帳號'}</b>
      </p>
      <p className="text-sm text-ink2">
        上次同步：{ago(meta.lastSyncAt)}
        {meta.dirty && '・有變更待同步'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void sync.connect()} disabled={sync.status === 'syncing'}>
          {sync.status === 'syncing' ? '同步中…' : '立即同步'}
        </Button>
        <Button onClick={() => window.confirm('登出後這台裝置不再同步，資料保留在這台裝置。確定登出？') && sync.signOut(false)}>登出（保留這台的資料）</Button>
        <Button
          variant="danger"
          onClick={() => window.confirm('登出並清除這台裝置上的記帳資料？雲端上的資料會保留，之後登入可以取回。') && sync.signOut(true)}
        >
          登出並清除這台的資料
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">有修改後約 5 秒會自動同步。授權約一小時到期，到期後點「同步」重新連線即可。共用裝置用完請選「登出並清除這台的資料」。</p>

      <div className="mt-4 border-t border-line pt-3">
        <button type="button" className="text-sm text-accent" onClick={() => setShowSnaps(!showSnaps)}>
          {showSnaps ? '▾' : '▸'} 還原同步前的資料
        </button>
        {showSnaps && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-muted">每次同步改動這台的資料前，都會自動保留一份（最近 5 份）。還原後會同步到其他裝置。</p>
            {snaps.length === 0 && <p className="text-sm text-muted">目前沒有快照</p>}
            {snaps.map((at) => (
              <div key={at} className="flex items-center justify-between gap-2 text-sm">
                <span>{fmtTime(at)} 同步前</span>
                <Button
                  onClick={async () => {
                    if (!window.confirm(`確定還原到 ${fmtTime(at)} 同步前的資料？目前的資料會被取代，並同步到其他裝置。`)) return;
                    const d = await loadSnapshot(at);
                    if (d) replace({ ...d, settings: { ...d.settings, lock: data.settings.lock, onboarded: true, isSample: false } });
                  }}
                >
                  還原
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <Button
          variant="danger"
          onClick={() =>
            window.confirm('確定刪除雲端上的所有記帳資料？所有裝置都會停止同步，各裝置上的資料保留。這個動作無法復原。') && void sync.deleteCloud()
          }
        >
          刪除雲端資料
        </Button>
      </div>
    </Card>
  );
}
