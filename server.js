const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const fp = path.join(ROOT, url === '/' ? 'index.html' : url);
  const ct = MIME[path.extname(fp)] || 'application/octet-stream';
  res.setHeader('Content-Type', ct);
  fs.createReadStream(fp)
    .on('error', () => { res.statusCode = 404; res.end('Not found'); })
    .pipe(res);
}).listen(8000, () => {
  console.log('Rodando em http://localhost:8000');
});
