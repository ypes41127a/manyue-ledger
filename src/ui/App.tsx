import { useState } from 'react';
import { emptyAppData } from '../core/defaults';
import { StoreProvider, useStore } from '../db/store';
import { exportBackup } from './actions';
import { daysSince, monthLabel } from './format';
import { HelpPage } from './HelpPage';
import { Banner, Button } from './kit';
import { LedgerPage } from './LedgerPage';
import { LockScreen } from './LockScreen';
import { Onboarding } from './Onboarding';
import { SettingsPage } from './SettingsPage';
import { defaultFillMonth, needsHomeScreenHint, overdueMonth } from './status';
import { StocksPage } from './StocksPage';
import { SyncProvider, useSync } from '../sync/SyncProvider';
import { SyncChip, SyncNotices } from './SyncUI';
import { Wizard } from './Wizard';

type Page = 'ledger' | 'stocks' | 'settings' | 'help';
const PAGES: { id: Page; label: string; icon: string }[] = [
  { id: 'ledger', label: '記帳', icon: '◐' },
  { id: 'stocks', label: '股票', icon: '◭' },
  { id: 'settings', label: '設定', icon: '⚙' },
  { id: 'help', label: '說明', icon: '?' },
];
const BACKUP_REMIND_DAYS = 35;

export function App() {
  return (
    <StoreProvider
      fallback={(error) => (
        <div className="flex min-h-dvh items-center justify-center p-6 text-center text-sm text-ink2">
          {error ? (
            <div className="space-y-3">
              <p className="text-danger">無法讀取資料：{error}</p>
              <Button onClick={() => window.location.reload()}>重新整理</Button>
            </div>
          ) : (
            '載入中…'
          )}
        </div>
      )}
    >
      <SyncProvider>
        <Root />
      </SyncProvider>
    </StoreProvider>
  );
}

function Root() {
  const { data } = useStore();
  const [unlocked, setUnlocked] = useState(false);
  if (data.settings.lock && !unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  if (!data.settings.onboarded) return <Onboarding />;
  return <Shell />;
}

function Shell() {
  const { data, meta, book, year, years, setYear, update, replace } = useStore();
  const sync = useSync();
  const [page, setPage] = useState<Page>('ledger');
  const [wizard, setWizard] = useState<number | null>(null);
  const [hideIos, setHideIos] = useState(false);
  const s = data.settings;
  const overdue = overdueMonth(data);
  const days = daysSince(s.lastBackupAt);
  const hasData = Object.values(data.years).some((b) => b.months.some((m) => m.started));
  const backupDue = !s.isSample && hasData && (days === null || days > BACKUP_REMIND_DAYS);
  const fill = (m?: number) => {
    // 已連結雲端但授權到期：開始填寫前先同步，取得其他裝置的最新資料
    if (meta.linked && sync.status === 'needs-auth') void sync.connect();
    setWizard(m ?? defaultFillMonth(book));
  };
  const go = (p: Page) => {
    setPage(p);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-dvh pb-24 sm:pb-8">
      <header className="sticky top-0 z-30 bg-brand text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5">
          <h1 className="text-lg font-semibold">滿月記帳</h1>
          <nav className="hidden gap-1 sm:flex" aria-label="主選單">
            {PAGES.map((p) => (
              <button key={p.id} type="button" onClick={() => go(p.id)} aria-current={page === p.id ? 'page' : undefined} className={`rounded-lg px-3 py-1.5 text-sm ${page === p.id ? 'bg-white/20 font-medium' : 'text-white/80 hover:bg-white/10'}`}>
                {p.label}
              </button>
            ))}
          </nav>
          <div className="flex-1" />
          <SyncChip />
          <select aria-label="切換年份" value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 rounded-lg border border-white/30 bg-transparent px-2 !text-sm text-white">
            {years.map((y) => (
              <option key={y} value={y} className="text-black">{y} 年</option>
            ))}
          </select>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-3 px-4 pt-4">
        <SyncNotices />
        {s.isSample && (
          <Banner tone="info" action={<Button onClick={() => window.confirm('確定清除範例資料，從空白開始設定？') && replace(emptyAppData(new Date().getFullYear()))}>清除範例，開始使用</Button>}>
            目前顯示的是<b>範例資料</b>，可以隨意點選試玩。
          </Banner>
        )}
        {!hideIos && needsHomeScreenHint() && (
          <Banner action={<Button variant="ghost" onClick={() => setHideIos(true)}>知道了</Button>}>
            <b>請把這個網頁加入主畫面。</b>在 Safari 點下方的分享按鈕 → 「加入主畫面」，之後從主畫面圖示開啟。直接在 Safari 使用時，7 天沒打開系統可能會自動清除你的記帳資料。
          </Banner>
        )}
        {!s.isSample && overdue && (
          <Banner
            action={
              <Button
                variant="primary"
                onClick={() => {
                  setYear(overdue.year);
                  setWizard(overdue.month);
                }}
              >
                現在填寫
              </Button>
            }
          >
            {overdue.year} 年 {monthLabel(overdue.month)}還沒有填寫完成。
          </Banner>
        )}
        {backupDue && (
          <Banner action={<Button variant="primary" onClick={() => exportBackup(data, update)}>下載備份</Button>}>
            {days === null ? '你還沒有下載過備份。' : `距離上次備份已經 ${days} 天。`}
            {meta.linked ? '雲端同步不能取代備份（誤刪的資料也會被同步出去），建議定期下載一份。' : '資料只存在這台裝置，建議現在備份。'}
          </Banner>
        )}

        {page === 'ledger' && <LedgerPage onFill={fill} />}
        {page === 'stocks' && <StocksPage onFill={fill} />}
        {page === 'settings' && <SettingsPage />}
        {page === 'help' && <HelpPage />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label="主選單">
        {PAGES.map((p) => (
          <button key={p.id} type="button" onClick={() => go(p.id)} aria-current={page === p.id ? 'page' : undefined} className={`flex flex-col items-center py-2 text-xs ${page === p.id ? 'font-semibold text-accent' : 'text-ink2'}`}>
            <span className="text-lg leading-6" aria-hidden>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </nav>

      {wizard !== null && <Wizard key={`${year}-${wizard}`} initialMonth={wizard} onClose={() => setWizard(null)} />}
    </div>
  );
}
