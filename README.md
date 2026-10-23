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

## 雲端同步（Google 雲端硬碟）

使用者可選擇用 Google 帳號登入，資料會同步到**使用者自己**雲端硬碟中本網頁專屬的隱藏資料夾（`appDataFolder`）。網站沒有伺服器，開發者看不到任何人的資料。

- 權限只有 `drive.appdata`（Google 分類為非敏感）與 `openid email`。
- 資料拆成「共用設定／每年項目設定／每個月」等單位，各自記錄修改時間，合併時每個單位保留較新的一份。
- 同步改動本機資料前會自動快照（保留 5 份），覆蓋雲端前會在雲端留備份（保留 3 份）。
- 用戶端 ID 設定在 `src/sync/config.ts` 的 `GOOGLE_CLIENT_ID`。**留空時正式網站不顯示同步功能**。

### 本機測試同步

`npm start` 時若沒有設定用戶端 ID（或網址加上 `?mockdrive`），會改用開發伺服器內建的模擬雲端硬碟，不需要 Google 帳號。用 `http://localhost:5174` 與 `http://127.0.0.1:5174` 兩個網址開啟，就是兩台互相同步的「裝置」。開發伺服器重開後模擬資料會清空。

### Google Cloud 設定（全部免費，不需要綁信用卡）

畫面上出現「免費試用」或「啟用帳單」的提示時都不用理會。

1. 到 <https://console.cloud.google.com>，上方「選取專案」→「新增專案」，名稱填 `manyue-ledger` →「建立」，並切換到這個專案。
2. 左上選單 →「API 和服務」→「程式庫」，搜尋 **Google Drive API** →「啟用」。
3. 左上選單 →「Google Auth Platform」→「開始」：
   - 應用程式名稱：`滿月記帳`；使用者支援電子郵件：選一個可以公開的 Email（使用者在 Google 登入畫面上看得到）。
   - 目標對象：**外部**；聯絡資訊填你的 Email；勾選同意 →「建立」。
4. 「品牌塑造」：
   - 應用程式首頁：`https://ypes41127a.github.io/manyue-ledger/`
   - 隱私權政策：`https://ypes41127a.github.io/manyue-ledger/privacy.html`
   - 已授權網域：`ypes41127a.github.io`
   - **不要上傳標誌**（上傳標誌會需要額外審核）→「儲存」。
5. 「資料存取」→「新增或移除範圍」，在「手動新增範圍」貼上 `https://www.googleapis.com/auth/drive.appdata` →「新增至表格」，再勾選 `openid` 與 `.../auth/userinfo.email` →「更新」→「儲存」。
6. 「目標對象」→「發布應用程式」→「確認」，狀態變成「實際運作中」。
7. 「用戶端」→「建立用戶端」：
   - 應用程式類型：**網頁應用程式**，名稱隨意。
   - 已授權的 JavaScript 來源：`https://ypes41127a.github.io` 和 `http://localhost:5174`（**不要**加路徑或結尾的 `/`）。
   - 「建立」後複製「用戶端 ID」（`....apps.googleusercontent.com`），填進 `src/sync/config.ts`。

## 自動匯率與股票搜尋

- **匯率**：填寫精靈會自動帶入填寫當天（補填過去月份時用該月最後一天）的匯率，來源是 [currency-api](https://github.com/fawazahmed0/exchange-api) 的市場中間價，免金鑰。抓不到時沿用上個月，使用者手動改過的幣別不會被覆蓋。程式在 `src/data/fx.ts`。
- **股票搜尋**：證交所、櫃買中心不允許網頁直接讀取，所以由 `scripts/update-securities.mjs` 下載台股（上市、上櫃、ETF）與美股（NASDAQ 公布的清單）代碼，存成 `public/data/securities.json`。GitHub Actions 每次部署與每週一都會重新下載；下載失敗時沿用專案內的檔案。美股的中文名稱寫在 `src/data/securities.ts` 的 `US_ALIASES`。
- 本機手動更新清單：`npm run update-securities`。
- 注意：公開專案 60 天沒有任何更新時，GitHub 會自動停用每週排程，清單就不會再更新（到 Actions 頁面可以重新啟用）。

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
  sync.ts       同步：拆單位、修改時間、合併
  sample.ts     範例資料（取自原始 Excel 填寫範例）
src/db/       IndexedDB 存取與 React 狀態
src/sync/     Google 登入、雲端硬碟讀寫、同步流程
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
