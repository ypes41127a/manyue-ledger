const DASH = '—';
const twd = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });

function finite(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** 台幣千分位，四捨五入到整數 */
export function fmtMoney(v: number | null | undefined): string {
  if (!finite(v)) return DASH;
  const r = Math.round(v);
  return twd.format(r === 0 ? 0 : r);
}

/** 帶正負號的金額，用於損益與成長 */
export function fmtSigned(v: number | null | undefined): string {
  if (!finite(v)) return DASH;
  const r = Math.round(v);
  return (r > 0 ? '+' : '') + twd.format(r === 0 ? 0 : r);
}

/** 百分比；分母為 0（null）時顯示「—」 */
export function fmtPct(v: number | null | undefined, digits = 1, signed = false): string {
  if (!finite(v)) return DASH;
  const p = v * 100;
  const s = p.toFixed(digits);
  return (signed && p > 0 && Number(s) !== 0 ? '+' : '') + s + '%';
}

/** 股數、匯率、原幣金額等可能有小數的數字 */
export function fmtNum(v: number | null | undefined): string {
  return finite(v) ? dec.format(v) : DASH;
}

/** 圖表座標軸用的精簡金額：12.5萬、1,200萬 */
export function fmtCompact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e8) return dec.format(v / 1e8) + '億';
  if (a >= 1e4) return dec.format(Math.round(v / 1e3) / 10) + '萬';
  return twd.format(v);
}

export const monthLabel = (m: number) => `${m + 1}月`;

export function fmtDate(iso: string | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function daysSince(iso: string | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / 86_400_000);
}
