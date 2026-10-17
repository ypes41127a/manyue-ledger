// Google 登入（Google Identity Services 的 token 模式）。
// 授權只放在記憶體中，關掉網頁就消失；約一小時後到期，需要使用者點一下重新連線。
import { GOOGLE_CLIENT_ID, SCOPES, useMockDrive } from './config';

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string; login_hint?: string }) => void;
}
interface GoogleOAuth {
  initTokenClient: (cfg: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type?: string; message?: string }) => void;
  }) => TokenClient;
  revoke: (token: string, done?: () => void) => void;
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth } };
  }
}

let token: { value: string; exp: number } | null = null;
let scriptPromise: Promise<void> | null = null;

export class NeedTapError extends Error {
  constructor() {
    super('Google 登入元件還在載入，請再按一次');
  }
}

/** 先載入 Google 登入元件。登入視窗必須在使用者點擊時同步開啟，所以要提前載好 */
export function preloadGoogle(): Promise<void> {
  if (useMockDrive) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('無法載入 Google 登入元件，請確認網路連線'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function currentToken(): string | null {
  if (!token || Date.now() > token.exp) {
    token = null;
    return null;
  }
  return token.value;
}

export function dropToken(): void {
  token = null;
}

/**
 * 開啟 Google 登入小視窗取得授權。必須在按鈕的點擊事件中呼叫。
 * @param hint 上次登入的 Email，已登入 Google 時小視窗會自動開了又關
 */
export function requestToken(hint?: string): Promise<string> {
  if (useMockDrive) {
    token = { value: 'mock', exp: Date.now() + 3600_000 };
    return Promise.resolve('mock');
  }
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) {
    void preloadGoogle();
    return Promise.reject(new NeedTapError());
  }
  return new Promise<string>((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (r) => {
        if (!r.access_token) return reject(new Error(r.error_description || r.error || 'Google 登入失敗'));
        // 提前 2 分鐘視為到期，避免同步到一半失效
        token = { value: r.access_token, exp: Date.now() + (Number(r.expires_in ?? 3600) - 120) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e) =>
        reject(new Error(e.type === 'popup_closed' ? '登入視窗已關閉' : e.type === 'popup_failed_to_open' ? '登入視窗被瀏覽器擋下，請允許彈出視窗後再試一次' : e.message || 'Google 登入失敗')),
    });
    client.requestAccessToken(hint ? { prompt: '', login_hint: hint } : { prompt: 'consent' });
  });
}

export async function fetchEmail(accessToken: string): Promise<string> {
  if (useMockDrive) return 'test@example.com';
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return '';
  return String(((await r.json()) as { email?: string }).email ?? '');
}

/** 撤銷授權：登出時呼叫，這個網頁就無法再存取雲端資料 */
export function revokeToken(): void {
  const t = token?.value;
  token = null;
  if (t && !useMockDrive) window.google?.accounts?.oauth2?.revoke(t);
}
