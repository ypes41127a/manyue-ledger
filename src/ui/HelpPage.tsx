import type { ReactNode } from 'react';
import { Card } from './kit';

function Q({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="border-t border-line py-3 first:border-t-0">
      <summary className="cursor-pointer text-sm font-medium text-ink">{q}</summary>
      <div className="mt-2 space-y-2 text-sm text-ink2">{children}</div>
    </details>
  );
}

export function HelpPage() {
  return (
    <div className="space-y-4">
      <Card title="滿月記帳法是什麼？">
        <div className="space-y-2 text-sm text-ink2">
          <p>不用每天記流水帳。每個月固定一天，把各個帳戶的餘額、當月收入與支出的「大項目總額」填一次，長期觀察個人淨值有沒有成長。</p>
          <p>日常的消費細項照常記在你習慣的手機記帳 App，月底把各分類的總額抄過來即可。</p>
          <p className="text-xs text-muted">滿月記帳法由柴鼠兄弟開發。</p>
        </div>
      </Card>

      <Card title="每個月怎麼填？">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink2">
          <li>在「記帳」分頁按<b className="text-ink">填寫本月</b>。</li>
          <li><b className="text-ink">匯率</b>：預設帶入上個月，有變再改。</li>
          <li><b className="text-ink">資產</b>：打開各家銀行 App，把目前餘額填進去。外幣帳戶填原幣金額（例如 1,000 美元），會自動換算。</li>
          <li><b className="text-ink">收入、支出</b>：填這個月的總額。固定項目會自動帶入上個月的數字。金額欄可以直接打算式，例如 <code>500+450+780</code>。</li>
          <li><b className="text-ink">投資</b>：這個月從存款轉去買股票、換外幣的金額。這些錢變成了資產，不算花掉。</li>
          <li><b className="text-ink">持股、損益與股息</b>：填每檔股票的股數與月底收盤價，以及成本、已實現損益、交易成本、收到的股息。美股都以美元輸入。</li>
          <li><b className="text-ink">確認</b>後按「完成本月」，再下載備份。</li>
        </ol>
        <p className="mt-3 text-sm text-ink2">每一步都會自動儲存，中途關掉也不會遺失。之後想修改，點表格上方的月份即可。</p>
      </Card>

      <Card title="常見問題">
        <Q q="數字是怎麼算的？">
          <p><b>個人淨值</b> ＝ 資產總計 − 當月支出總計（與原始滿月記帳表相同；若在設定開啟「負債」，會再減去負債總計）。</p>
          <p><b>淨值月成長率</b> ＝（本月淨值 − 上月淨值）÷ 上月淨值。</p>
          <p><b>儲蓄率</b> ＝（收入 − 支出）÷ 收入。「支出轉資產（投資）」不算在支出裡。</p>
          <p><b>利息/股利</b> ＝ 你填的銀行利息 ＋ 股票分頁的現金股利（自動）。</p>
          <p><b>未實現獲利率</b> ＝（總現值 − 總付出成本）÷ 總付出成本。<b>已實現報酬率</b> ＝（賣出 − 買進）÷ 買進。</p>
          <p><b>交易成本</b> ＝ 手續費 − 電子折讓 ＋ 證交稅。</p>
          <p>分母是 0 而無法計算時，會顯示「—」。</p>
        </Q>
        <Q q="資產裡的「台股、美股」為什麼不能填？">
          <p>它們會自動帶入股票分頁算出的持股現值（股數 × 月底收盤價，美股再乘以當月美元匯率），避免兩邊數字不一致。</p>
        </Q>
        <Q q="資料存在哪裡？安全嗎？">
          <p>所有資料只存在<b>這台裝置的這個瀏覽器</b>裡，不會上傳到任何地方，也沒有帳號。</p>
          <p>缺點是：換手機、換瀏覽器、清除瀏覽器資料，或 iPhone 的 Safari 太久沒開，資料都可能不見。所以請養成<b>每月填完就下載備份</b>的習慣。</p>
        </Q>
        <Q q="怎麼備份？怎麼搬到新手機？">
          <p>到「設定 → 備份與還原」按「匯出備份」，會下載一個 JSON 檔。把它存到雲端硬碟、或用 LINE／Email 傳給自己。</p>
          <p>在新裝置打開這個網頁，選「設定 → 匯入備份」並選那個檔案，就會還原全部資料。</p>
        </Q>
        <Q q="iPhone 要怎麼加入主畫面？">
          <p>用 <b>Safari</b> 打開這個網頁 → 點下方的<b>分享</b>按鈕（方框加向上箭頭）→ 選<b>「加入主畫面」</b>。之後從主畫面的圖示開啟。</p>
          <p>這很重要：只在 Safari 分頁中使用時，若 7 天沒有打開，系統可能自動清除網站資料。加入主畫面後就不受這個限制，也能離線使用。</p>
          <p>Android 的 Chrome：點右上角選單 → 「安裝應用程式」或「加到主畫面」。</p>
        </Q>
        <Q q="忘記密碼鎖的密碼怎麼辦？">
          <p>密碼無法找回。只能在鎖定畫面選擇清除這台裝置的資料，再用備份檔還原。所以開啟密碼鎖之前，請先確定手上有最新的備份。</p>
        </Q>
        <Q q="新的一年怎麼辦？">
          <p>到「設定 → 年度」按「建立下一年度」，會帶入你的帳戶、持股與 12 月匯率。填 1 月時會自動帶入去年 12 月的餘額。右上角可以切換年份查看。</p>
        </Q>
        <Q q="可以匯出成 Excel 嗎？">
          <p>可以。「設定 → 備份與還原 → 匯出 Excel」會產生與原始滿月記帳表相似格式的檔案。注意 Excel 檔無法匯入回來，備份請用「匯出備份」。</p>
        </Q>
      </Card>
    </div>
  );
}
