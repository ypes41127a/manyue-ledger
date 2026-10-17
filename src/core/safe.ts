/** 分母為 0（或非有限數）時回傳 null，畫面顯示「—」 */
export function safeDiv(a: number | null, b: number | null): number | null {
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

export function num(v: number | undefined | null): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function sum(xs: readonly (number | undefined | null)[]): number {
  let t = 0;
  for (const x of xs) t += num(x);
  return t;
}

export function newId(prefix: string): string {
  const r =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${r}`;
}
