import { useState } from 'react';
import { sampleAppData } from '../core/sample';
import { useStore } from '../db/store';
import { CurrencyEditor, FillDayPicker, HoldingsEditor, ItemsEditor } from './editors';
import { Banner, Button, Card } from './kit';
import { useSync } from '../sync/SyncProvider';

const SETUP = ['帳戶', '持股', '外幣與匯率', '每月填寫日'] as const;

export function Onboarding() {
  const { update, replace } = useStore();
  const sync = useSync();
  const [stage, setStage] = useState<'welcome' | 'choose' | 'setup'>('welcome');
  const [step, setStep] = useState(0);
  const finish = () => update((d) => (d.settings.onboarded = true));

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      {stage === 'welcome' && (
        <div className="space-y-4">
          <div className="pt-8 text-center">
            <img src="./icon.svg" alt="" className="mx-auto size-20 rounded-3xl" />
            <h1 className="mt-4 text-2xl font-semibold">滿月記帳</h1>
            <p className="mt-1 text-sm text-ink2">一個月只記一次的記帳表</p>
          </div>
          <Card>
            <ul className="space-y-3 text-sm text-ink2">
              <li><b className="text-ink">一個月填一次。</b>日常花費照常記在你習慣的手機 App，每月固定一天把各帳戶餘額、收入與支出的「大項目總額」填進來。</li>
              <li><b className="text-ink">看的是淨值有沒有長大。</b>填完就能看到淨值趨勢、資產配置、儲蓄率，以及股票的損益與股息。</li>
              <li><b className="text-ink">資料只存在你的裝置。</b>沒有帳號、不會上傳到任何伺服器；請記得定期下載備份檔。</li>
            </ul>
            <p className="mt-4 text-xs text-muted">滿月記帳法由柴鼠兄弟開發。本網頁為依其記帳表概念製作的填寫工具。</p>
          </Card>
          <Button variant="primary" className="w-full" onClick={() => setStage('choose')}>開始使用</Button>
        </div>
      )}

      {stage === 'choose' && (
        <div className="space-y-4 pt-8">
          <h1 className="text-xl font-semibold">你想怎麼開始？</h1>
          <button type="button" className="block w-full rounded-2xl border border-line bg-surface p-4 text-left hover:border-accent" onClick={() => setStage('setup')}>
            <div className="font-semibold">從空白開始設定</div>
            <div className="mt-1 text-sm text-ink2">花 3 分鐘設定自己的帳戶、持股與外幣，馬上開始記帳。</div>
          </button>
          <button type="button" className="block w-full rounded-2xl border border-line bg-surface p-4 text-left hover:border-accent" onClick={() => replace(sampleAppData(new Date().getFullYear()))}>
            <div className="font-semibold">載入範例資料試玩</div>
            <div className="mt-1 text-sm text-ink2">先用一整年的範例數字看看圖表和表格長什麼樣子，之後可以一鍵清除再開始。</div>
          </button>
          {sync.available && (
            <button type="button" className="block w-full rounded-2xl border border-line bg-surface p-4 text-left hover:border-accent" disabled={sync.status === 'syncing'} onClick={() => void sync.connect({ restoreOnly: true })}>
              <div className="font-semibold">{sync.status === 'syncing' ? '連線中…' : '我在別的裝置用過，登入 Google 取回資料'}</div>
              <div className="mt-1 text-sm text-ink2">在其他裝置登入同步過的話，用同一個 Google 帳號登入就能取回所有資料。</div>
            </button>
          )}
          {sync.message && <Banner>{sync.message}</Banner>}
          <Button variant="ghost" onClick={() => setStage('welcome')}>← 返回</Button>
        </div>
      )}

      {stage === 'setup' && (
        <div className="space-y-4">
          <div>
            <div className="text-xs text-muted">設定 {step + 1} / {SETUP.length}</div>
            <h1 className="text-xl font-semibold">{SETUP[step]}</h1>
          </div>
          {step === 0 && (
            <Card>
              <p className="mb-3 text-sm text-ink2">這是預設的資產帳戶。把名稱改成你自己的（例如銀行名稱），用不到的按 ✕ 刪掉，不夠的在最下面新增。收入與支出的項目之後可以在「設定」調整。</p>
              <ItemsEditor section="asset" />
            </Card>
          )}
          {step === 1 && (
            <Card>
              <p className="mb-3 text-sm text-ink2">新增你目前持有的股票或 ETF。每月填寫時只要輸入股數和月底收盤價，市值會自動算好。沒有投資可以直接下一步。</p>
              <HoldingsEditor />
            </Card>
          )}
          {step === 2 && (
            <Card>
              <p className="mb-3 text-sm text-ink2">外幣帳戶會用這裡的匯率換算成台幣。持有美股的話請保留美元。</p>
              <CurrencyEditor />
            </Card>
          )}
          {step === 3 && (
            <Card>
              <p className="mb-3 text-sm text-ink2">選一個每月固定填寫的日子（例如發薪日後或月初）。之後可以在「設定」下載行事曆提醒。</p>
              <FillDayPicker />
            </Card>
          )}
          <div className="flex gap-2">
            <Button onClick={() => (step === 0 ? setStage('choose') : setStep(step - 1))}>上一步</Button>
            <div className="flex-1" />
            {step < SETUP.length - 1 ? <Button variant="primary" onClick={() => setStep(step + 1)}>下一步</Button> : <Button variant="primary" onClick={finish}>完成設定</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
