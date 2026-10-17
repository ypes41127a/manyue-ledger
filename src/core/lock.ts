import type { LockInfo } from './types';

const ITERATIONS = 150_000;

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return toHex(bits);
}

/** 只存雜湊，不存密碼本身。這是畫面鎖，資料本身沒有加密。 */
export async function createLock(password: string): Promise<LockInfo> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toHex(salt), hash: await derive(password, salt, ITERATIONS), iterations: ITERATIONS };
}

export async function verifyLock(password: string, lock: LockInfo): Promise<boolean> {
  return (await derive(password, fromHex(lock.salt), lock.iterations)) === lock.hash;
}
