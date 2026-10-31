import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/calculator.js': ['calculator.js', 'text/javascript'] };
const server = createServer(async (request, response) => {
  const file = files[new URL(request.url, 'http://localhost').pathname];
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
