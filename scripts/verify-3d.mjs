/**
 * TEMPORARY P3 verification: drives the real Product3DViewer in Chromium with
 * hard assertions (desktop drag, keyboard, finish switch, fallback, mobile
 * touch swipe) and a non-blank render check on the WebGL canvas.
 * Removed after verification.
 */
import pw from '/opt/appjet/browser/node_modules/playwright/index.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const { chromium } = pw;
const ROOT = process.cwd();
const DIST = '/tmp/p3dist';
const PORT = 5199;
const failures = [];
const passes = [];

function check(name, condition, detail = '') {
  if (condition) passes.push(`${name}${detail ? ` (${detail})` : ''}`);
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

// 1. Build the harness bundle.
const build = spawnSync(path.join(ROOT, 'node_modules/.bin/vite'), ['build', '--config', 'vite.harness.config.ts'], {
  cwd: ROOT,
  encoding: 'utf8',
});
if (build.status !== 0) {
  console.error('harness build failed');
  console.error(build.stdout?.slice(-2000), build.stderr?.slice(-2000));
  process.exit(1);
}

// 2. Static server for the built bundle.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.join(DIST, rel === '/' ? '/verify3d.html' : rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const readout = async (page, id) => {
  const text = await page.locator(id).innerText();
  const match = text.match(/(-?\d+)°/);
  return match ? Number(match[1]) : null;
};

const consoleErrors = [];

try {
  // ---------- Desktop ----------
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`); });

  await page.goto(`http://127.0.0.1:${PORT}/verify3d.html`, { waitUntil: 'load' });
  await page.waitForSelector('#viewer-supported [role="application"] canvas', { state: 'visible', timeout: 45000 });

  const engine = await page.getAttribute('#viewer-supported canvas', 'data-engine');
  check('WebGL renderer initialised', Boolean(engine), String(engine));

  // Non-blank render evidence: screenshot the canvas and measure variance.
  const canvas = page.locator('#viewer-supported canvas');
  const box = await canvas.boundingBox();
  check('canvas has layout size', Boolean(box && box.width > 100 && box.height > 100), box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'none');
  await page.screenshot({ path: '/tmp/p3-canvas.png', clip: box });
  const stats = spawnSync('convert', ['/tmp/p3-canvas.png', '-colorspace', 'Gray', '-format', '%[fx:standard_deviation] %k', 'info:'], { encoding: 'utf8' });
  const [sd, colors] = (stats.stdout || '0 0').trim().split(' ').map(Number);
  check('3D scene renders non-blank output', sd > 0.02, `stddev=${sd.toFixed(4)}`);
  check('3D scene has tonal range', colors > 200, `${colors} colors`);

  // Fallback for unsupported products.
  const fallback = await page.locator('#viewer-unsupported').innerText();
  check('unsupported product shows fallback', fallback.includes('A 3D studio preview is not available for this product.'));
  check('fallback has no canvas', (await page.locator('#viewer-unsupported canvas').count()) === 0);

  // Card variant renders too.
  await page.waitForSelector('#viewer-card canvas', { state: 'visible', timeout: 45000 });
  check('card variant canvas visible', true);

  // Deterministic rotation: pause auto-spin, reset, then drag 60px.
  await page.getByRole('button', { name: 'Pause auto-rotation' }).click();
  await page.getByRole('button', { name: 'Reset view' }).click();
  check('reset sets 0 degrees', (await readout(page, '#viewer-supported')) === 0);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  check('drag rotates the model', (await readout(page, '#viewer-supported')) === 27, `readout=${await readout(page, '#viewer-supported')}`);

  // Keyboard rotation (+15 degrees).
  await page.locator('#viewer-supported [role="application"]').click();
  await page.keyboard.press('ArrowRight');
  check('arrow key rotates the model', (await readout(page, '#viewer-supported')) === 42, `readout=${await readout(page, '#viewer-supported')}`);

  // Finish variation.
  await page.getByRole('button', { name: 'Brushed' }).click();
  check('finish variation is selectable', (await page.getByRole('button', { name: 'Brushed' }).getAttribute('aria-pressed')) === 'true');

  // Accessible contract.
  const label = await page.getAttribute('#viewer-supported [role="application"]', 'aria-label');
  check('viewer exposes keyboard instructions', Boolean(label && label.includes('left and right arrow keys')), String(label));
  const note = await page.locator('#viewer-supported').innerText();
  check('studio disclosure is present', note.includes('not a manufacturer CAD or official brand asset'));

  await desktop.close();

  // ---------- Mobile ----------
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mpage = await mobile.newPage();
  mpage.on('pageerror', (e) => consoleErrors.push(`mobile pageerror: ${e.message}`));
  await mpage.goto(`http://127.0.0.1:${PORT}/verify3d.html`, { waitUntil: 'load' });
  await mpage.waitForSelector('#viewer-supported [role="application"] canvas', { state: 'visible', timeout: 45000 });
  check('mobile renders the 3D viewer', true);

  const mbox = await mpage.locator('#viewer-supported canvas').boundingBox();
  check('mobile canvas fits viewport', Boolean(mbox && mbox.width <= 390 && mbox.width > 100), mbox ? `${Math.round(mbox.width)}x${Math.round(mbox.height)}` : 'none');

  await mpage.getByRole('button', { name: 'Pause auto-rotation' }).click();
  await mpage.getByRole('button', { name: 'Reset view' }).click();

  const cdp = await mobile.newCDPSession(mpage);
  const cx = mbox.x + mbox.width / 2;
  const cy = mbox.y + mbox.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 60, y: cy }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mpage.waitForTimeout(400);
  check('touch swipe rotates the model', (await readout(mpage, '#viewer-supported')) === 27, `readout=${await readout(mpage, '#viewer-supported')}`);

  await mobile.close();
} catch (error) {
  failures.push(`unexpected: ${String(error).slice(0, 400)}`);
} finally {
  await browser.close();
  server.close();
}

check('no page or console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

console.log('\nPASS:');
for (const p of passes) console.log('  ✓', p);
if (failures.length) {
  console.log('\nFAIL:');
  for (const f of failures) console.log('  ✗', f);
  process.exit(1);
}
console.log(`\nAll ${passes.length} 3D checks passed.`);
