/**
 * Google Cloud「網頁應用程式」OAuth 用戶端 ID。這個值本來就是公開的，可以直接放在程式裡。
 * 留空時：正式網站不顯示雲端同步；本機開發自動改用模擬雲端硬碟。
 */
export const GOOGLE_CLIENT_ID = '';

/** 只存取本網頁在使用者雲端硬碟中的專屬隱藏資料夾，以及顯示已登入的 Email */
export const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email';

export const useMockDrive = import.meta.env.DEV && (!GOOGLE_CLIENT_ID || new URLSearchParams(location.search).has('mockdrive'));

export const syncAvailable = useMockDrive || GOOGLE_CLIENT_ID !== '';
