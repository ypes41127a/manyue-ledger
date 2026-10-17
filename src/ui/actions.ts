import { backupFileName, toBackup } from '../core/backup';
import type { AppData } from '../core/types';
import { downloadBlob } from './kit';

/** 下載備份檔並記錄備份時間 */
export function exportBackup(data: AppData, update: (fn: (d: AppData) => void) => void): void {
  const now = new Date();
  const file = toBackup(data, now);
  downloadBlob(backupFileName(now), new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
  update((d) => (d.settings.lastBackupAt = now.toISOString()));
}
