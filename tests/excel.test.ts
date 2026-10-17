import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { emptyAppData } from '../src/core/defaults';
import { sampleAppData } from '../src/core/sample';
import { buildExcel } from '../src/export/excel';

async function load(blob: Blob) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  return wb;
}
const text = (ws: ExcelJS.Worksheet) => {
  const out: string[] = [];
  ws.eachRow((row) => row.eachCell((c) => typeof c.value === 'string' && out.push(c.value)));
  return out;
};

describe('匯出 Excel', () => {
  it('產生記帳與股票兩張工作表，總計列帶公式', async () => {
    const wb = await load(await buildExcel(sampleAppData(2026)));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['2026年記帳', '2026年股票']);
    const ledger = wb.getWorksheet('2026年記帳')!;
    const labels = text(ledger);
    for (const l of ['資產總計', '收入總計', '支出總計', '投資總計', '個人淨值', '淨值月成長率(%)']) expect(labels).toContain(l);
    let expenseTotal: ExcelJS.CellValue = null;
    ledger.eachRow((row) => {
      if (row.getCell(2).value === '支出總計') expenseTotal = row.getCell(17).value;
    });
    expect(expenseTotal).toMatchObject({ formula: expect.stringContaining('SUM('), result: 562544 });
    const stock = text(wb.getWorksheet('2026年股票')!);
    for (const l of ['持股現值總計', '未實現損益總計', '已實現損益總計', '交易成本總計', '股息總計']) expect(stock).toContain(l);
  });

  it('空白資料也能匯出', async () => {
    const wb = await load(await buildExcel(emptyAppData(2026)));
    expect(wb.worksheets).toHaveLength(2);
  });
});
