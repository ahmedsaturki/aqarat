import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function safePath(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, 'http://localhost').pathname);
  const relativePath = pathname === '/' ? 'dashboard/index.html' : pathname.replace(/^\/+/, '');
  const relative = relativePath.endsWith('/') ? `${relativePath}index.html` : relativePath;
  const target = normalize(join(root, relative));
  return target.startsWith(root) ? target : null;
}

const server = http.createServer(async (request, response) => {
  const target = safePath(request.url || '/');
  if (!target) {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'content-type': types[extname(target)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`visual server listening on ${port}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
