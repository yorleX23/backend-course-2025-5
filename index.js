const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const superagent = require('superagent');

program
  .requiredOption('-H, --host <host>', 'server host')
  .requiredOption('-P, --port <port>', 'server port')
  .requiredOption('-C, --cache <cacheDir>', 'cache directory');

program.parse(process.argv);
const options = program.opts();

console.log('Parsed options:', options);

const HOST = options.host;
const PORT = Number(options.port);
const CACHE_DIR = path.resolve(process.cwd(), options.cache);

async function ensureCache() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}
function filePathForCode(code) {
  return path.join(CACHE_DIR, `${code}.jpg`);
}

const server = http.createServer(async (req, res) => {
  try {
    const code = (req.url || '').split('/').filter(Boolean)[0];
    if (!code) {
      res.writeHead(400);
      return res.end('Bad request: expected /<code>');
    }
    const filePath = filePathForCode(code);

    if (req.method === 'GET') {
      try {
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        return res.end(data);
      } catch (err) {
        try {
          const resp = await superagent.get(`https://http.cat/${code}`).responseType('buffer');
          if (resp && resp.body) {
            await fs.writeFile(filePath, resp.body);
            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            return res.end(resp.body);
          } else {
            res.writeHead(404);
            return res.end('Not Found');
          }
        } catch (err2) {
          res.writeHead(404);
          return res.end('Not Found');
        }
      }
    } else if (req.method === 'PUT') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      await fs.writeFile(filePath, buffer);
      res.writeHead(201, { 'Content-Type': 'text/plain' });
      return res.end('Created');
    } else if (req.method === 'DELETE') {
      try {
        await fs.unlink(filePath);
        res.writeHead(200);
        return res.end('Deleted');
      } catch (err) {
        res.writeHead(404);
        return res.end('Not Found');
      }
    } else {
      res.writeHead(405);
      return res.end('Method not allowed');
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

(async () => {
  await ensureCache();
  server.listen(PORT, HOST, () => console.log(`Server running at http://${HOST}:${PORT}`));
})();
