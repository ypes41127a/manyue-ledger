import type { AppData, YearBook } from '../core/types';

/** none：開始使用之前的月份，不需要補填 */
export type MonthStatus = 'done' | 'todo' | 'future' | 'none';

export function monthStatus(book: YearBook, month: number, hasPrevYear: boolean, now = new Date()): MonthStatus {
  if (book.months[month].completed) return 'done';
  const y = now.getFullYear();
  if (book.year > y || (book.year === y && month > now.getMonth())) return 'future';
  if (!hasPrevYear) {
    // 沒有前一年度時，第一個開始填寫的月份之前都視為尚未開始使用
    const first = book.months.findIndex((m) => m.started || m.completed);
    const start = first >= 0 ? first : book.year === y ? now.getMonth() : 11;
    if (month < start) return 'none';
  }
  return 'todo';
}

/** 上個月（依今天日期）若應填而尚未完成，回傳其年月 */
export function overdueMonth(data: AppData, now = new Date()): { year: number; month: number } | null {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const book = data.years[d.getFullYear()];
  if (!book || monthStatus(book, d.getMonth(), !!data.years[book.year - 1], now) !== 'todo') return null;
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** 填寫精靈預設月份：今年為當月，其他年度為第一個未完成的月份 */
export function defaultFillMonth(book: YearBook, now = new Date()): number {
  if (book.year === now.getFullYear()) return now.getMonth();
  const i = book.months.findIndex((m) => !m.completed);
  return i < 0 ? 11 : i;
}

/** iPhone / iPad 的 Safari 且尚未加入主畫面：資料可能在 7 天未使用後被系統清除 */
export function needsHomeScreenHint(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}
