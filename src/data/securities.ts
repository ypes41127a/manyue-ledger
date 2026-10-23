// 股票代碼搜尋：清單由 scripts/update-securities.mjs 產生（public/data/securities.json）。
import type { Market } from '../core/types';

export interface Security {
  code: string;
  name: string;
  market: Market;
  /** 美股的中文名（手動整理的熱門股） */
  alias?: string;
}

export interface SecurityDb {
  updatedAt: string;
  list: Security[];
}

/** 熱門美股與 ETF 的中文名，讓使用者可以用中文搜尋 */
export const US_ALIASES: Record<string, string> = {
  AAPL: '蘋果', MSFT: '微軟', NVDA: '輝達', GOOGL: '谷歌 Google（A股）', GOOG: '谷歌 Google（C股）', AMZN: '亞馬遜',
  META: '臉書 Meta', TSLA: '特斯拉', TSM: '台積電 ADR', AVGO: '博通', AMD: '超微', INTC: '英特爾', QCOM: '高通',
  NFLX: '網飛', ORCL: '甲骨文', ADBE: 'Adobe', CSCO: '思科', MU: '美光', ASML: '艾司摩爾', ARM: '安謀',
  PLTR: 'Palantir', SMCI: '美超微', DELL: '戴爾', HPQ: '惠普', 'BRK.B': '波克夏', JPM: '摩根大通', V: 'Visa',
  MA: '萬事達卡', BAC: '美國銀行', WMT: '沃爾瑪', COST: '好市多', KO: '可口可樂', PEP: '百事', MCD: '麥當勞',
  SBUX: '星巴克', NKE: '耐吉', DIS: '迪士尼', JNJ: '嬌生', PFE: '輝瑞', LLY: '禮來', NVO: '諾和諾德',
  UNH: '聯合健康', XOM: '埃克森美孚', BA: '波音', UBER: '優步', ABNB: 'Airbnb', BABA: '阿里巴巴',
  SPY: '標普500 ETF', VOO: '先鋒標普500 ETF', IVV: '安碩標普500 ETF', VTI: '先鋒全美股市 ETF', VT: '先鋒全世界股市 ETF',
  QQQ: '那斯達克100 ETF', QQQM: '那斯達克100 ETF', DIA: '道瓊 ETF', SOXX: '半導體 ETF', SMH: '半導體 ETF',
  SCHD: '美國高股息 ETF', VYM: '先鋒高股息 ETF', BND: '先鋒總體債券 ETF', TLT: '20年期以上美國公債 ETF',
  VEA: '先鋒已開發市場 ETF', VWO: '先鋒新興市場 ETF', GLD: '黃金 ETF',
};

let loading: Promise<SecurityDb> | null = null;

export function loadSecurities(): Promise<SecurityDb> {
  loading ??= fetch('./data/securities.json')
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<{ updatedAt: string; tw: [string, string][]; us: [string, string][] }>;
    })
    .then((j) => ({
      updatedAt: j.updatedAt,
      list: [
        ...j.tw.map(([code, name]): Security => ({ code, name, market: 'TW' })),
        ...j.us.map(([code, name]): Security => ({ code, name, market: 'US', alias: US_ALIASES[code] })),
      ],
    }))
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

/** 全形轉半形、臺→台、去空白、轉小寫 */
export function norm(s: string): string {
  return s.normalize('NFKC').replace(/臺/g, '台').replace(/\s+/g, '').toLowerCase();
}

function score(s: Security, q: string): number {
  const code = s.code.toLowerCase();
  const name = norm(s.name);
  const alias = s.alias ? norm(s.alias) : '';
  if (code === q) return 100;
  if (name === q) return 90;
  if (code.startsWith(q)) return 80 - Math.min(code.length - q.length, 10);
  if (name.startsWith(q)) return 65;
  // 中文別名稍微排在正式名稱後面：搜尋「台積」時台積電排在台積電 ADR 前面
  if (alias && alias.startsWith(q)) return 64;
  if (name.includes(q)) return 50;
  if (alias && alias.includes(q)) return 49;
  return 0;
}

/** 用代碼、名稱或中文名搜尋，依相符程度排序 */
export function searchSecurities(db: SecurityDb, query: string, limit = 8): Security[] {
  const q = norm(query);
  if (!q) return [];
  const cjk = /[㐀-鿿]/.test(q);
  return db.list
    .map((s) => ({ s, v: score(s, q) }))
    .filter((x) => x.v > 0)
    .map((x) => ({ ...x, v: x.v + (cjk && x.s.market === 'TW' ? 0.5 : 0) }))
    .sort((a, b) => b.v - a.v || a.s.code.length - b.s.code.length || a.s.code.localeCompare(b.s.code))
    .slice(0, limit)
    .map((x) => x.s);
}

/** 依代碼找完全相符的股票 */
export function findByCode(db: SecurityDb, code: string, market?: Market): Security | undefined {
  const c = code.trim().toUpperCase();
  return db.list.find((s) => s.code.toUpperCase() === c && (!market || s.market === market));
}
