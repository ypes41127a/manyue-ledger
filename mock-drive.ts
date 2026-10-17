// 本機開發用的模擬雲端硬碟（只在 npm start / vite 開發伺服器中啟用，不會進入正式網站）。
// 用 http://localhost:5174 與 http://127.0.0.1:5174 兩個網址開啟，就能模擬兩台裝置互相同步。
import type { Plugin } from 'vite';

export function mockDrive(): Plugin {
  const files = new Map<string, { name: string; text: string }>();
  let seq = 0;
  let expireNext = false;
  return {
    name: 'mock-drive',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__mock-drive', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://x');
        const send = (code: number, body = '') => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(body);
        };
        // 測試「授權過期」：GET /__mock-drive/expire 之後的下一個請求回 401
        if (url.pathname === '/expire') {
          expireNext = true;
          return send(200, '{}');
        }
        if (url.pathname === '/reset') {
          files.clear();
          return send(200, '{}');
        }
        if (req.headers.authorization !== 'Bearer mock' || expireNext) {
          expireNext = false;
          return send(401, '{}');
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const id = url.pathname.split('/')[2];
          if (url.pathname === '/files' && req.method === 'GET') {
            const prefix = url.searchParams.get('prefix') ?? '';
            return send(200, JSON.stringify([...files].filter(([, f]) => f.name.startsWith(prefix)).map(([fid, f]) => ({ id: fid, name: f.name }))));
          }
          if (url.pathname === '/files' && req.method === 'POST') {
            const fid = `f${++seq}`;
            files.set(fid, { name: url.searchParams.get('name') ?? 'file', text: body });
            return send(200, JSON.stringify({ id: fid }));
          }
          const f = id ? files.get(id) : undefined;
          if (!f) return send(404, '{}');
          if (req.method === 'GET') return send(200, f.text);
          if (req.method === 'PUT') {
            f.text = body;
            return send(200, '{}');
          }
          if (req.method === 'DELETE') {
            files.delete(id);
            return send(204);
          }
          send(405, '{}');
        });
      });
    },
  };
}
