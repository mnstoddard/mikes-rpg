const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const [root, jobsFile, outDir, only] = process.argv.slice(2);
const MT = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MT[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(8765);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 600, height: 500 } });
  await pg.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  pg.on('pageerror', (e) => console.log('[err]', e.message));
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text().slice(0, 200)); });
  await pg.goto('http://localhost:8765/index.html');
  await pg.waitForFunction(() => window.__dbg && window.__dbg.hero(), null, { timeout: 60000 });
  await pg.addScriptTag({ path: path.join(__dirname, 'export-hero.js') });
  fs.mkdirSync(outDir, { recursive: true });
  for (const job of JSON.parse(fs.readFileSync(jobsFile, 'utf8'))) {
    if (only && !only.split(',').includes(job.file)) continue;
    const r = await pg.evaluate((j) => window.__exportPerson(j), job);
    const buf = Buffer.from(r.b64, 'base64'); fs.writeFileSync(path.join(outDir, job.file + '.glb'), buf);
    console.log(job.file, (buf.length / 1024).toFixed(0) + ' KB', r.tris + ' tris', r.clips + ' clips', r.parts.join(','));
  }
  await b.close(); srv.close();
})();
