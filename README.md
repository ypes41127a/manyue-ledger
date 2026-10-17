# 滿月記帳

每月填一次的「滿月記帳表」網頁版。純前端靜態網站：沒有後端、沒有帳號，資料只存在使用者自己瀏覽器的 IndexedDB；可加入手機主畫面並離線使用（PWA）。

> 滿月記帳法由柴鼠兄弟開發。本專案是依其記帳表概念製作的填寫工具。

技術：Vite + React + TypeScript、Tailwind CSS、Recharts、Dexie（IndexedDB）、vite-plugin-pwa、exceljs、Vitest。

## 在自己的電腦上啟動

**最簡單的方式**：在 Finder 雙擊 `start.command`，瀏覽器會自動打開。關掉跳出來的終端機視窗就會停止。

或是在終端機輸入（這台電腦的 Node.js 放在專案內的 `.tools/node`）：

```bash
cd ~/Documents/money
export PATH="$PWD/.tools/node/bin:$PATH"
npm start          # 啟動開發伺服器並打開瀏覽器
npm test           # 執行單元測試
npm run build      # 產生正式版到 dist/
```

換一台電腦開發時，先安裝 Node.js 22 以上，再執行 `npm install`。

## 部署到 GitHub Pages（第一次）

完成後會得到一個像 `https://你的帳號.github.io/manyue-ledger/` 的網址，把它傳給別人就能使用。

### 1. 準備帳號與工具
1. 到 <https://github.com> 註冊帳號並登入。
2. 到 <https://desktop.github.com> 下載安裝 **GitHub Desktop**，打開後用剛剛的帳號登入。

### 2. 把專案交給 GitHub Desktop
1. GitHub Desktop 選單 **File → Add Local Repository…**
2. 按 **Choose…**，選擇 `文件/money` 這個資料夾，按 **Add Repository**。
3. 左側會列出所有檔案。在左下角 **Summary** 欄位輸入 `第一版`，按 **Commit to main**。

### 3. 上傳到 GitHub
1. 按上方的 **Publish repository**。
2. **Name** 填 `manyue-ledger`（可自訂，會成為網址的一部分）。
3. **取消勾選「Keep this code private」**（免費帳號的 GitHub Pages 需要公開的 repository）。
4. 按 **Publish Repository**。

> 公開的只有程式碼。使用者的記帳資料存在各自的瀏覽器裡，不會出現在 GitHub。`.gitignore` 已排除原始 Excel 範本，不會被上傳。

### 4. 開啟 GitHub Pages
1. 在 GitHub Desktop 選單 **Repository → View on GitHub**，瀏覽器會打開你的 repository。
2. 點上方 **Settings** → 左側 **Pages**。
3. **Build and deployment** 底下的 **Source** 選 **GitHub Actions**。
4. 點上方 **Actions** 分頁 → 左側 **Deploy to GitHub Pages** → 右側 **Run workflow** → 綠色的 **Run workflow**。
5. 等 1–2 分鐘，出現綠色勾勾後，回到 **Settings → Pages**，頁面上方會顯示網址。

### 5. 測試
用手機打開網址，依「說明」頁的步驟加入主畫面。

## 之後更新網站

1. 修改程式後，打開 GitHub Desktop，左側會列出改過的檔案。
2. 在 **Summary** 輸入這次改了什麼，按 **Commit to main**，再按上方 **Push origin**。
3. GitHub 會自動重新建置並部署（約 1–2 分鐘）。使用者下次打開網頁時自動更新，**他們的資料不受影響**。

每次推送都會先跑單元測試，測試沒過就不會部署。

## 改資料格式時一定要做的事

使用者的資料存在他們自己的裝置上，更新網站時必須能自動升級，不可遺失：

1. 把 `src/core/types.ts` 的 `CURRENT_SCHEMA` 加 1。
2. 在 `src/core/migrate.ts` 的 `MIGRATIONS` 加一筆「舊版本號 → 升級函式」。**已發布的步驟不可修改或刪除**，舊備份檔也靠它升級。
3. 在 `tests/data.test.ts` 加測試，確認舊格式資料升級後數值不變。

升級前，程式會自動在 IndexedDB 留一份舊版快照（`snapshot-v版本號`）。資料版本比網頁新時（例如使用者開著舊分頁），程式會拒絕讀取而不是覆蓋。

## 專案結構

```
src/core/     計算邏輯與資料模型（純函式，有單元測試）
  ledger.ts     記帳：小計、總計、淨值、成長率、儲蓄率
  stocks.ts     股票：市值、未實現/已實現損益、交易成本、股息
  carry.ts      帶入上個月、建立新年度
  migrate.ts    資料版本升級
  backup.ts     備份檔格式
  sample.ts     範例資料（取自原始 Excel 填寫範例）
src/db/       IndexedDB 存取與 React 狀態
src/export/   匯出 Excel
src/ui/       畫面
tests/        單元測試（以 Excel 填寫範例的數字驗證）
```

## 計算規則

- 個人淨值 ＝ 資產總計 − 當月支出總計（同原始滿月記帳表）；開啟負債區塊後再減負債總計
- 淨值月成長率 ＝（本月淨值 − 上月淨值）÷ 上月淨值
- 儲蓄率 ＝（收入 − 支出）÷ 收入；「支出轉資產（投資）」不計入支出
- 外幣帳戶輸入原幣金額，以當月匯率換算；匯率未填則沿用上個月
- 美股的股價、成本、買賣金額、交易成本、股利皆以美元輸入，以當月美元匯率換算
- 「利息/股利」＝ 手動輸入的銀行利息 ＋ 股票現金股利
- 交易成本 ＝ 手續費 − 電子折讓 ＋ 證交稅
- 分母為 0 時顯示「—」
