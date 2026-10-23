// 下載台股（上市、上櫃、ETF）與美股代碼清單，產生 public/data/securities.json。
// 證交所、櫃買中心不允許網頁直接讀取，所以由 GitHub Actions 在部署時執行這支程式，把清單放進網站。
// 用法：node scripts/update-securities.mjs
import { writeFile } from 'node:fs/promises';

const OUT = new URL('../public/data/securities.json', import.meta.url);

async function get(url, as = 'json') {
  const r = await fetch(url, { headers: { 'User-Agent': 'manyue-ledger (github.com/ypes41127a/manyue-ledger)' } });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return as === 'json' ? r.json() : r.text();
}

// 一般股票為 4 碼數字；ETF 為 00 開頭（例如 0050、00878、00400A）。排除權證、債券等
const twKeep = (code) => /^\d{4}$/.test(code) || /^00\d{2,4}[A-Z]?$/.test(code);

async function taiwan() {
  const [twse, tpex] = await Promise.all([
    get('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
    get('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes'),
  ]);
  const map = new Map();
  for (const s of twse) if (twKeep(s.Code)) map.set(s.Code, s.Name.trim());
  for (const s of tpex) if (twKeep(s.SecuritiesCompanyCode)) map.set(s.SecuritiesCompanyCode, s.CompanyName.trim());
  return [...map].sort((a, b) => a[0].localeCompare(b[0]));
}

const NOISE = /\b(Warrants?|Units?|Rights?|Notes? due|Debentures?|Depositary Shares? Representing.*Preferred|Preferred)\b/i;
function cleanName(n) {
  return n
    .replace(/\s*-\s*(Class [A-Z] )?(Common Stock|Ordinary Shares?|American Depositary Shares?).*$/i, '')
    .replace(/\s+(Class [A-Z] )?(Common Stock|Ordinary Shares?|Common Shares?)$/i, '')
    .replace(/\s+American Depositary Shares?.*$/i, '')
    .trim();
}

async function us() {
  const [nq, ot] = await Promise.all([
    get('https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt', 'text'),
    get('https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt', 'text'),
  ]);
  const map = new Map();
  const rows = (txt) => txt.split(/\r?\n/).slice(1).filter((l) => l && !l.startsWith('File Creation Time')).map((l) => l.split('|'));
  // nasdaqlisted：Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares
  for (const c of rows(nq)) if (c[3] === 'N' && !NOISE.test(c[1])) map.set(c[0], cleanName(c[1]));
  // otherlisted：ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
  for (const c of rows(ot)) if (c[6] === 'N' && !NOISE.test(c[1]) && !/[$]/.test(c[0])) map.set(c[0], cleanName(c[1]));
  return [...map].sort((a, b) => a[0].localeCompare(b[0]));
}

const [tw, usList] = await Promise.all([taiwan(), us()]);
if (tw.length < 1000 || usList.length < 5000) throw new Error(`清單筆數異常：台股 ${tw.length}、美股 ${usList.length}，保留原本的清單`);
await writeFile(OUT, JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), tw, us: usList }));
console.log(`已更新：台股 ${tw.length} 檔、美股 ${usList.length} 檔`);
