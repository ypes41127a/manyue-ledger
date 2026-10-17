import type { Worksheet } from 'exceljs';
import { computeLedger, prevDecemberNetWorth } from '../core/ledger';
import { rateOf } from '../core/stocks';
import { MARKET_LABEL, MARKETS, MONTHS } from '../core/types';
import type { AppData, Section, YearBook } from '../core/types';

const MONEY = '#,##0;[Red]-#,##0';
const PCT = '0.0%';
const FIRST = 5; // E 欄 = 1 月
const TOTAL = 17; // Q
const PCT_COL = 18; // R
const col = (n: number) => String.fromCharCode(64 + n);
const mcol = (m: number) => col(FIRST + m);
const f = (formula: string, result: number | null) => ({ formula, result: result ?? undefined });
const div = (a: string, b: string) => `IFERROR(${a}/${b},"")`;

function header(ws: Worksheet, title: string, year: number, totalLabel: string) {
  ws.getCell('B2').value = title;
  ws.getCell('B2').font = { bold: true, size: 14 };
  ws.getCell('E2').value = `${year}年`;
  ws.getCell(2, TOTAL).value = totalLabel;
  ws.getCell(2, PCT_COL).value = '%';
  for (const m of MONTHS) ws.getCell(3, FIRST + m).value = `${m + 1}月`;
  for (const r of [2, 3]) ws.getRow(r).font = { bold: true };
  ws.getRow(3).alignment = { horizontal: 'right' };
  ws.columns.forEach((c, i) => (c.width = i < 1 ? 2 : i < 3 ? 12 : i === 3 ? 24 : 13));
  ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 3 }];
}

function shade(ws: Worksheet, row: number) {
  ws.getRow(row).font = { bold: true };
  for (let c = 2; c <= PCT_COL; c++) ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0EFEC' } };
}

function ledgerSheet(ws: Worksheet, data: AppData, book: YearBook) {
  const l = computeLedger(book, data.settings, prevDecemberNetWorth(data.years, book.year, data.settings));
  header(ws, '滿月記帳表', book.year, 'Total');
  ws.getCell(2, PCT_COL + 1).value = '備註';
  ws.getColumn(PCT_COL + 1).width = 36;
  const sections: [Section, string, string][] = [
    ['asset', '資產市值', '資產總計'],
    ['income', '收入', '收入總計'],
    ['expense', '支出', '支出總計'],
    ['invest', '支出轉資產', '投資總計'],
  ];
  if (data.settings.liabilitiesEnabled) sections.push(['liability', '負債', '負債總計']);
  const totalRow: Partial<Record<Section, number>> = {};
  let r = 4;
  for (const [s, title, totalTitle] of sections) {
    const items = l.groups[s].flatMap((g) => g.items.map((it) => ({ it, group: g.group })));
    const balance = s === 'asset' || s === 'liability';
    const start = r;
    const end = r + items.length - 1;
    const sumRow = end + 1;
    ws.getCell(r, 2).value = title;
    let lastGroup = '';
    for (const { it, group } of items) {
      if (group !== lastGroup) ws.getCell(r, 3).value = lastGroup = group;
      ws.getCell(r, 4).value = it.kind === 'fx' ? `${it.name}（${it.currency}，已換算台幣）` : it.name;
      for (const m of MONTHS) if (l.active[m]) ws.getCell(r, FIRST + m).value = Math.round(l.itemValues[it.id][m]);
      const first = mcol(Math.max(l.first, 0));
      const last = mcol(Math.max(l.last, 0));
      ws.getCell(r, TOTAL).value = balance ? f(`${last}${r}-${first}${r}`, l.itemTotal[it.id]) : f(`SUM(E${r}:P${r})`, l.itemTotal[it.id]);
      ws.getCell(r, PCT_COL).value = balance ? f(div(`Q${r}`, `${first}${r}`), l.itemPct[it.id]) : f(div(`Q${r}`, `$Q$${sumRow}`), l.itemPct[it.id]);
      const note = book.months.map((e) => e.notes[it.id]);
      if (note.some(Boolean)) {
        const c = ws.getCell(r, PCT_COL + 1);
        c.value = note.map((n, m) => (n ? `${m + 1}月：${n}` : '')).filter(Boolean).join('；');
        c.alignment = { wrapText: true, vertical: 'top' };
      }
      r++;
    }
    ws.getCell(r, 2).value = totalTitle;
    for (const m of MONTHS) if (l.active[m]) ws.getCell(r, FIRST + m).value = items.length ? f(`SUM(${mcol(m)}${start}:${mcol(m)}${end})`, l.totals[s][m]) : 0;
    const first = mcol(Math.max(l.first, 0));
    const last = mcol(Math.max(l.last, 0));
    ws.getCell(r, TOTAL).value = balance ? f(`${last}${r}-${first}${r}`, l.sectionTotal[s]) : f(`SUM(E${r}:P${r})`, l.sectionTotal[s]);
    if (balance) ws.getCell(r, PCT_COL).value = f(div(`Q${r}`, `${first}${r}`), l.sectionPct[s]);
    shade(ws, r);
    totalRow[s] = r;
    r++;
  }

  const netRow = r;
  ws.getCell(r, 2).value = '個人淨值';
  for (const m of MONTHS) {
    if (!l.active[m]) continue;
    const c = mcol(m);
    const liab = totalRow.liability ? `-${c}${totalRow.liability}` : '';
    ws.getCell(r, FIRST + m).value = f(`${c}${totalRow.asset}-${c}${totalRow.expense}${liab}`, l.netWorth[m]);
  }
  if (l.last >= 0) {
    ws.getCell(r, TOTAL).value = l.netWorthChange;
    ws.getCell(r, PCT_COL).value = l.netWorthChangePct ?? '';
  }
  shade(ws, r);
  r++;
  ws.getCell(r, 2).value = '淨值月成長率(%)';
  for (const m of MONTHS) {
    if (!l.active[m] || l.growth[m] === null) continue;
    ws.getCell(r, FIRST + m).value = m === 0 ? l.growth[0] : f(div(`(${mcol(m)}${netRow}-${mcol(m - 1)}${netRow})`, `${mcol(m - 1)}${netRow}`), l.growth[m]);
  }
  ws.getRow(r).numFmt = PCT;
  r++;
  ws.getCell(r, 2).value = '儲蓄率(%)';
  for (const m of MONTHS) if (l.active[m]) ws.getCell(r, FIRST + m).value = f(div(`(${mcol(m)}${totalRow.income}-${mcol(m)}${totalRow.expense})`, `${mcol(m)}${totalRow.income}`), l.savingsRate[m]);
  ws.getRow(r).numFmt = PCT;

  for (let i = 4; i < netRow + 1; i++) {
    for (let c = FIRST; c <= TOTAL; c++) ws.getCell(i, c).numFmt = MONEY;
    ws.getCell(i, PCT_COL).numFmt = PCT;
  }
  r += 2;
  ws.getCell(r, 2).value = '匯率';
  ws.getCell(r, 2).font = { bold: true };
  for (const c of book.currencies) {
    ws.getCell(r, 4).value = `${c.name}（${c.code}）`;
    for (const m of MONTHS) if (l.active[m]) ws.getCell(r, FIRST + m).value = rateOf(book, m, c.code);
    r++;
  }
  ws.getCell(r + 1, 2).value = '◉ 滿月記帳法開發製表：柴鼠兄弟　◉ 本檔由滿月記帳網頁匯出，金額單位為新台幣';
}

function stockSheet(ws: Worksheet, data: AppData, book: YearBook) {
  const s = computeLedger(book, data.settings).stocks;
  header(ws, '股票版記帳', book.year, '年度總計');
  let r = 4;
  type Kind = 'money' | 'pct' | 'num' | 'text';
  const row = (c: string, d: string, values: (number | string | null | undefined)[], total: number | string | null | undefined, kind: Kind = 'money', bold = false) => {
    ws.getCell(r, 3).value = c;
    ws.getCell(r, 4).value = d;
    for (const m of MONTHS) {
      const v = values[m];
      if (!s.active[m] || v === null || v === undefined || v === '') continue;
      ws.getCell(r, FIRST + m).value = kind === 'money' && typeof v === 'number' ? Math.round(v) : v;
    }
    if (total !== null && total !== undefined) ws.getCell(r, TOTAL).value = kind === 'money' && typeof total === 'number' ? Math.round(total) : total;
    const fmt = kind === 'pct' ? PCT : kind === 'money' ? MONEY : kind === 'num' ? '#,##0.##' : undefined;
    if (fmt) for (let i = FIRST; i <= TOTAL; i++) ws.getCell(r, i).numFmt = fmt;
    if (kind === 'text') ws.getRow(r).alignment = { wrapText: true, vertical: 'top' };
    if (bold) shade(ws, r);
    r++;
  };
  const title = (t: string) => {
    ws.getCell(r, 2).value = t;
    ws.getCell(r, 2).font = { bold: true };
  };
  const sum = (v: number[]) => v.reduce((t, x) => t + x, 0);
  const a = s.annual;

  title('1 持股庫存');
  for (const h of book.holdings) {
    const tag = `${h.code} ${h.name}`;
    row(tag, '股數', book.months.map((e) => e.shares[h.id]), null, 'num');
    row('', `收盤價${h.market === 'US' ? '(美元)' : ''}`, book.months.map((e) => e.prices[h.id]), null, 'num');
    row('', '市值(台幣)', s.holdingValue[h.id], s.last >= 0 ? s.holdingValue[h.id][s.last] : null);
  }
  row('持股現值總計', '', s.totalValue, a.value, 'money', true);

  title('2 未實現損益');
  for (const mk of MARKETS) {
    const c = s.market[mk];
    const y = s.annualByMarket[mk];
    row(MARKET_LABEL[mk], '總現值', c.value, y.value);
    row('', '總付出成本(含息)', c.cost, y.cost);
    row('', '損益試算', c.pl, y.unrealPl);
    row('', '獲利率%', c.plRate, y.unrealRate, 'pct');
    row('', '標的備註', book.months.map((e) => e.stock[mk].unrealNote), null, 'text');
  }
  row('未實現損益總計', '', s.unrealPl, a.unrealPl, 'money', true);

  title('3 已實現損益');
  for (const mk of MARKETS) {
    const c = s.market[mk];
    const y = s.annualByMarket[mk];
    row(MARKET_LABEL[mk], '總賣出金額', c.sell, y.sell);
    row('', '總買進金額', c.buy, y.buy);
    row('', '損益試算', c.realized, y.realized);
    row('', '報酬率%', c.realizedRate, y.realizedRate, 'pct');
    row('', '標的備註', book.months.map((e) => e.stock[mk].realNote), null, 'text');
  }
  row('已實現損益總計', '', s.realized, a.realized, 'money', true);
  row('已實現報酬率', '', s.realizedRate, a.realizedRate, 'pct', true);

  title('4 交易成本');
  for (const mk of MARKETS) {
    const c = s.market[mk];
    row(MARKET_LABEL[mk], '手續費(減項)', c.fee, sum(c.fee));
    row('', '電子折讓(加項)', c.rebate, sum(c.rebate));
    row('', '證交稅(減項)', c.tax, sum(c.tax));
  }
  row('交易成本總計', '', s.netCost, a.netCost, 'money', true);

  title('5 股息');
  for (const h of book.holdings) if (sum(s.holdingCashDiv[h.id])) row('現金股利', `${h.code} ${h.name}`, s.holdingCashDiv[h.id].map((v) => v || null), sum(s.holdingCashDiv[h.id]));
  for (const h of book.holdings) {
    const v = book.months.map((e) => e.stockDiv[h.id]);
    if (v.some(Boolean)) row('股票股利(股)', `${h.code} ${h.name}`, v, sum(v.map((x) => x ?? 0)), 'num');
  }
  row('股息總計', '', s.cashDiv, a.cashDiv, 'money', true);
  ws.getCell(r + 1, 2).value = '◉ 滿月記帳法開發製表：柴鼠兄弟　◉ 金額單位為新台幣，美股以當月美元匯率換算';
}

/** 匯出成與原始滿月記帳表類似的 Excel 檔（exceljs 較大，使用時才載入） */
export async function buildExcel(data: AppData): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  for (const book of Object.values(data.years).sort((a, b) => a.year - b.year)) {
    ledgerSheet(wb.addWorksheet(`${book.year}年記帳`), data, book);
    stockSheet(wb.addWorksheet(`${book.year}年股票`), data, book);
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
