// 自動抓取匯率：fawazahmed0 currency-api（每日更新的市場中間價，免金鑰、網頁可直接讀取）。
// 主要來源 jsDelivr，備援 Cloudflare Pages。

const SOURCES = [
  (date: string) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/twd.min.json`,
  (date: string) => `https://${date}.currency-api.pages.dev/v1/currencies/twd.min.json`,
];
/** 當天資料還沒發布時，最多往前找幾天 */
const LOOKBACK_DAYS = 7;

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 要抓哪一天的匯率：填寫當天，但不超過該月最後一天（填未來月份時用今天） */
export function rateTargetDate(year: number, month: number, today = new Date()): string {
  const last = new Date(year, month + 1, 0);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return isoDate(t < last ? t : last);
}

/** 1 外幣 ＝ 多少台幣。資料是「1 台幣 ＝ 多少外幣」，所以取倒數 */
export function parseRates(json: unknown, codes: string[]): Record<string, number> {
  const table = (json as { twd?: Record<string, number> })?.twd ?? {};
  const out: Record<string, number> = {};
  for (const code of codes) {
    const v = table[code.toLowerCase()];
    if (typeof v === 'number' && v > 0 && Number.isFinite(v)) {
      const r = 1 / v;
      // 依大小保留有效位數：美元 31.9413、日幣 0.20175
      out[code] = Number(r.toPrecision(6));
    }
  }
  return out;
}

export interface FetchedRates {
  /** 實際取得資料的日期（當天沒資料時會是前幾天） */
  date: string;
  rates: Record<string, number>;
}

async function tryDate(date: string): Promise<unknown | null> {
  for (const src of SOURCES) {
    try {
      const r = await fetch(src(date));
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
    } catch {
      // 換下一個來源
    }
  }
  throw new Error('無法連線到匯率資料來源');
}

export async function fetchRatesOn(date: string, codes: string[]): Promise<FetchedRates> {
  const d = new Date(`${date}T00:00:00`);
  for (let i = 0; i <= LOOKBACK_DAYS; i++) {
    const day = isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i));
    const json = await tryDate(day);
    if (json) return { date: day, rates: parseRates(json, codes) };
  }
  throw new Error('找不到這段期間的匯率資料');
}
