import { computeLedger } from './ledger';
import { migrate } from './migrate';
import { APP_ID } from './types';
import type { AppData } from './types';

export interface BackupFile {
  app: string;
  kind: 'backup';
  schemaVersion: number;
  exportedAt: string;
  data: AppData;
}

export interface BackupSummary {
  exportedAt: string;
  schemaVersion: number;
  years: { year: number; completedMonths: number; items: number; holdings: number; netWorth: number | null }[];
}

export function toBackup(data: AppData, now = new Date()): BackupFile {
  // 密碼鎖只屬於這台裝置，不放進備份檔，還原後才不會被舊密碼鎖住
  const settings = { ...data.settings };
  delete settings.lock;
  return {
    app: APP_ID,
    kind: 'backup',
    schemaVersion: data.schemaVersion,
    exportedAt: now.toISOString(),
    data: { ...data, settings },
  };
}

export function backupFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `滿月記帳備份_${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export function summarize(data: AppData, exportedAt: string, schemaVersion: number): BackupSummary {
  return {
    exportedAt,
    schemaVersion,
    years: Object.values(data.years)
      .sort((a, b) => a.year - b.year)
      .map((b) => {
        const l = computeLedger(b, data.settings);
        return {
          year: b.year,
          completedMonths: b.months.filter((m) => m.completed).length,
          items: b.items.length,
          holdings: b.holdings.length,
          netWorth: l.last >= 0 ? l.netWorth[l.last] : null,
        };
      }),
  };
}

/** 解析並升級備份檔；格式不對會丟出中文錯誤訊息 */
export function parseBackup(text: string): { data: AppData; summary: BackupSummary } {
  let file: any;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('這不是有效的備份檔（無法讀取 JSON）');
  }
  if (!file || file.app !== APP_ID || file.kind !== 'backup' || !file.data) {
    throw new Error('這不是滿月記帳的備份檔');
  }
  const original = typeof file.schemaVersion === 'number' ? file.schemaVersion : 1;
  const data = migrate({ ...file.data, schemaVersion: original });
  return { data, summary: summarize(data, String(file.exportedAt ?? ''), original) };
}
