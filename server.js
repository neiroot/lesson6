import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import ai from './api/explain.js';

const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/calculator.js': ['calculator.js', 'text/javascript'] };
const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/api/explain') {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) if (value !== undefined) headers.set(name, String(value));
    try {
      const webRequest = new Request(url, {
        method: request.method, headers,
        ...(request.method !== 'GET' && request.method !== 'HEAD' ? { body: request, duplex: 'half' } : {}),
      });
      const result = await ai.fetch(webRequest);
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(await result.text());
    } catch { response.writeHead(500); response.end('Unable to process request'); }
    return;
  }
  const file = files[url.pathname];
  if (!file) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const body = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(body);
  } catch { response.writeHead(500); response.end('Unable to read file'); }
});
let port = Number(process.env.PORT || 3000);
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && port < 3100) server.listen(++port, '127.0.0.1');
  else { console.error(error); process.exit(1); }
});
server.listen(port, '127.0.0.1', () => console.log(`Калькулятор: http://localhost:${port}`));
