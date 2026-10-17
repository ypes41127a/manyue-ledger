import { useState } from 'react';
import { emptyAppData } from '../core/defaults';
import { verifyLock } from '../core/lock';
import { useStore } from '../db/store';
import { Button } from './kit';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { data, replace } = useStore();
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [forgot, setForgot] = useState(false);
  const submit = async () => {
    if (data.settings.lock && (await verifyLock(pw, data.settings.lock))) onUnlock();
    else setError(true);
  };
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6">
      <img src="./icon.svg" alt="" className="mx-auto size-16 rounded-2xl" />
      <h1 className="text-center text-xl font-semibold">滿月記帳已鎖定</h1>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input type="password" autoFocus aria-label="密碼" placeholder="輸入密碼" value={pw} onChange={(e) => { setPw(e.target.value); setError(false); }} className="h-12 w-full rounded-xl border border-line bg-surface px-3" />
        {error && <p className="text-sm text-danger">密碼不正確</p>}
        <Button variant="primary" className="w-full" type="submit">解鎖</Button>
      </form>
      <button type="button" className="text-sm text-accent" onClick={() => setForgot(!forgot)}>忘記密碼？</button>
      {forgot && (
        <div className="space-y-2 rounded-2xl bg-warnbg p-4 text-sm text-warnink">
          <p>密碼無法找回。唯一的方法是清除這台裝置上的資料，然後用你之前下載的備份檔還原。</p>
          <p>如果沒有備份檔，清除後資料將無法復原。</p>
          <Button variant="danger" onClick={() => window.confirm('確定要清除這台裝置上的所有記帳資料嗎？這個動作無法復原。') && (replace(emptyAppData(new Date().getFullYear())), onUnlock())}>
            清除資料並重新開始
          </Button>
        </div>
      )}
    </div>
  );
}
