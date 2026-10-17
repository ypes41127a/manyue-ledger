// 讀寫使用者雲端硬碟中「本網頁專屬的隱藏資料夾」(appDataFolder)。
import { useMockDrive } from './config';

export class AuthError extends Error {
  constructor() {
    super('Google 授權已過期，請重新連線');
  }
}

export interface DriveFile {
  id: string;
  name: string;
}

export interface DriveApi {
  list(prefix: string): Promise<DriveFile[]>;
  read(id: string): Promise<string>;
  create(name: string, text: string): Promise<string>;
  update(id: string, text: string): Promise<void>;
  remove(id: string): Promise<void>;
}

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

async function call(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  let r: Response;
  try {
    r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error('無法連線到 Google 雲端硬碟，請確認網路連線');
  }
  if (r.status === 401) throw new AuthError();
  if (!r.ok) throw new Error(`Google 雲端硬碟回應錯誤（${r.status}）`);
  return r;
}

export function googleDrive(token: string): DriveApi {
  return {
    async list(prefix) {
      const q = encodeURIComponent(`name contains '${prefix.replace(/'/g, "\\'")}' and trashed = false`);
      const r = await call(`${API}?spaces=appDataFolder&q=${q}&fields=files(id,name)&pageSize=100`, token);
      return ((await r.json()) as { files: DriveFile[] }).files.filter((f) => f.name.startsWith(prefix));
    },
    async read(id) {
      return (await call(`${API}/${id}?alt=media`, token)).text();
    },
    async create(name, text) {
      const boundary = 'manyue' + Math.random().toString(36).slice(2);
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' }) +
        `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
      const r = await call(`${UPLOAD}?uploadType=multipart&fields=id`, token, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      });
      return ((await r.json()) as { id: string }).id;
    },
    async update(id, text) {
      await call(`${UPLOAD}/${id}?uploadType=media`, token, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text });
    },
    async remove(id) {
      await call(`${API}/${id}`, token, { method: 'DELETE' });
    },
  };
}

/** 本機開發用：資料存在開發伺服器的記憶體中（見 vite.config.ts 的 mockDrive） */
export function mockDrive(token: string): DriveApi {
  const req = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(`/__mock-drive${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
    if (r.status === 401) throw new AuthError();
    if (!r.ok) throw new Error(`模擬雲端硬碟錯誤（${r.status}）`);
    return r;
  };
  return {
    list: async (prefix) => (await (await req(`/files?prefix=${encodeURIComponent(prefix)}`)).json()) as DriveFile[],
    read: async (id) => (await req(`/files/${id}`)).text(),
    create: async (name, text) => ((await (await req(`/files?name=${encodeURIComponent(name)}`, { method: 'POST', body: text })).json()) as { id: string }).id,
    update: async (id, text) => void (await req(`/files/${id}`, { method: 'PUT', body: text })),
    remove: async (id) => void (await req(`/files/${id}`, { method: 'DELETE' })),
  };
}

export const driveFor = (token: string): DriveApi => (useMockDrive ? mockDrive(token) : googleDrive(token));
