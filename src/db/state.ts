import { stampChanges } from '../core/sync';
import type { AppData } from '../core/types';
import type { SyncMeta } from './db';

export interface State {
  data: AppData;
  meta: SyncMeta;
}

/** 使用者修改資料後的新狀態：記錄改到的部分，已連結雲端時標記為「尚未同步」 */
export function withStamps(cur: State, data: AppData, now = Date.now()): State {
  // 整份重設（清除資料）時一併解除雲端連結，避免把空白資料同步出去蓋掉雲端
  if (!data.settings.onboarded && cur.meta.linked) {
    return { data, meta: { ...cur.meta, linked: false, email: undefined, stamps: {}, synced: {}, dirty: false, lastSyncAt: undefined } };
  }
  const stamps = stampChanges(cur.meta.stamps, cur.data, data, cur.meta.deviceId, now);
  if (stamps === cur.meta.stamps) return { data, meta: cur.meta };
  return { data, meta: { ...cur.meta, stamps, dirty: cur.meta.dirty || cur.meta.linked } };
}
