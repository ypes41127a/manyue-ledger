/** 每月填寫日：1–28，或 LAST_DAY 代表每月最後一天 */
export const LAST_DAY = 31;

export function buildReminderIcs(fillDay: number, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const last = fillDay >= 29;
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = last ? new Date(year, month + 1, 0).getDate() : fillDay;
  const start = new Date(year, month, day);
  const end = new Date(year, month, day + 1);
  const d = (x: Date) => `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}`;
  const stamp = `${d(now)}T${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//manyue-ledger//ZH-TW',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:manyue-ledger-monthly-${fillDay}@local`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d(start)}`,
    `DTEND;VALUE=DATE:${d(end)}`,
    `RRULE:FREQ=MONTHLY;BYMONTHDAY=${last ? -1 : fillDay}`,
    'SUMMARY:滿月記帳：填寫本月記帳表',
    'DESCRIPTION:打開滿月記帳網頁，填寫本月資產、收入、支出與股票，完成後記得下載備份。',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:今天是滿月記帳日',
    'TRIGGER:PT9H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
