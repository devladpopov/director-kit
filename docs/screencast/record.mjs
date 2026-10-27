// Records the 60-90 s screencast from the demo board (sample data only).
// node docs/screencast/record.mjs  ->  docs/screencast/director-kit.webm, then:
//   ffmpeg -i director-kit.webm -c:v libx264 -pix_fmt yuv420p -crf 23 -movflags +faststart director-kit.mp4
//   ffmpeg -i director-kit.webm -vf "fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer" director-kit.gif
// Needs playwright installed globally (npm i -g playwright) and chromium (npx playwright install chromium).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { buildBoard } from '../../lib/board.mjs';
import { demoScan } from '../../lib/demo.mjs';
import { renderAudit } from '../../lib/audit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
// Global module dir: PLAYWRIGHT_ROOT if set, else `npm root -g`.
const globalRoot = process.env.PLAYWRIGHT_ROOT || execSync('npm root -g').toString().trim();
const { chromium } = createRequire(path.join(globalRoot, 'noop.js'))('playwright');

const W = 1280, H = 720;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Real CLI output for the terminal scenes.
const cli = (...a) => execFileSync(process.execPath, [path.join(ROOT, 'bin/director-kit.mjs'), ...a, '--no-open']).toString().trim();
const demoOut = cli('demo').replace(os.homedir(), '~').replace(/\\/g, '/');
const auditMd = renderAudit(buildBoard(demoScan()), { backups: [] }).markdown
  .split('\n## Backups')[0].replace(/\*\*/g, '').trim();
const boardFile = path.join(os.homedir(), '.director-kit', 'demo', 'board.html');

const CAPTION = `#cap{position:fixed;left:50%;top:22px;transform:translateX(-50%);max-width:1000px;background:rgba(17,24,39,.92);color:#fff;
font:600 22px/1.35 system-ui,Segoe UI,sans-serif;padding:12px 22px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);z-index:99;text-align:center}
#cap:empty{display:none}body.board #cap{top:auto;left:auto;right:28px;bottom:28px;transform:none;max-width:560px;text-align:left}.hl{outline:3px solid #f59e0b!important;outline-offset:4px;border-radius:10px;transition:outline .2s}`;

const term = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0d1117;color:#e6edf3;font:18px/1.45 Consolas,ui-monospace,monospace;height:100vh;display:flex;align-items:center;justify-content:center}
.win{width:1100px;min-height:520px;margin-top:60px;background:#161b22;border:1px solid #30363d;border-radius:12px;overflow:hidden}
.bar{height:34px;background:#21262d;display:flex;gap:8px;align-items:center;padding:0 14px}.bar i{width:12px;height:12px;border-radius:50%;background:#484f58}
pre{margin:0;padding:22px 26px;white-space:pre-wrap}.p{color:#7ee787}.d{color:#8b949e}.h{color:#79c0ff;font-weight:700}
.title{font:700 46px/1.25 system-ui,Segoe UI,sans-serif;text-align:center;padding:0 60px}.sub{font:400 26px/1.4 system-ui,sans-serif;color:#8b949e;margin-top:18px}
${CAPTION}</style><body><div class="win" id="win"><div class="bar"><i></i><i></i><i></i></div><pre id="o"></pre></div><div id="cap"></div>`;

async function caption(page, text) {
  await page.evaluate(([t, css]) => {
    if (!document.getElementById('cap')) {
      const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
      const d = document.createElement('div'); d.id = 'cap'; document.body.appendChild(d);
    }
    document.getElementById('cap').textContent = t;
  }, [text, CAPTION]);
}

async function type(page, cmd) {
  await page.evaluate(() => { document.getElementById('o').innerHTML += '<span class="p">$ </span>'; });
  for (const ch of cmd) {
    await page.evaluate(c => { document.getElementById('o').insertAdjacentText('beforeend', c); }, ch);
    await sleep(55);
  }
  await sleep(400);
  await page.evaluate(() => { document.getElementById('o').insertAdjacentText('beforeend', '\n'); });
}

async function print(page, html, lineMs = 0) {
  for (const line of html.split('\n')) {
    await page.evaluate(l => { document.getElementById('o').insertAdjacentHTML('beforeend', l + '\n'); }, line);
    if (lineMs) await sleep(lineMs);
  }
}

const hl = (page, sel, on = true) => page.evaluate(([s, on]) => document.querySelectorAll('.hl').forEach(e => e.classList.remove('hl')) || (on && document.querySelectorAll(s).forEach(e => e.classList.add('hl'))), [sel, on]);
const col = n => `.col:nth-of-type(${n})`;

const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-rec-'));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'light', recordVideo: { dir: videoDir, size: { width: W, height: H } } });
const page = await ctx.newPage();

// 1. Problem (0-7 s)
await page.setContent(term);
await page.evaluate(() => { document.getElementById('win').outerHTML = '<div><div class="title">13 projects with Claude Code.<br>Which one is waiting on you?</div><div class="sub">director-kit: one board over all of them, from your git history</div></div>'; });
await sleep(6500);

// 2. Install and run (7-19 s)
await page.setContent(term);
await caption(page, 'One command, no account, nothing leaves your machine');
await sleep(800);
await type(page, 'npx director-kit demo');
await sleep(700);
await print(page, `<span class="d">${esc(demoOut)}</span>`, 250);
await sleep(4500);

// 3. Board (19-52 s)
await page.goto(pathToFileURL(boardFile).href);
await page.evaluate(() => document.body.classList.add('board'));
await caption(page, 'Every project in one place: status from CHECKPOINT.md, activity from git');
await sleep(6000);
await hl(page, col(1));
await caption(page, '"Waiting on you": the agent stopped and needs your decision');
await sleep(6000);
await hl(page, '.col h2');
const stalledIdx = await page.evaluate(() => [...document.querySelectorAll('.col h2')].findIndex(h => /stalled/i.test(h.textContent)) + 1);
await hl(page, col(stalledIdx));
await caption(page, '"Stalled": no commits for a week, the next step is still written down');
await sleep(6000);
await hl(page, '.pill.risk');
await caption(page, 'At risk: no remote, unpushed commits, uncommitted work');
await sleep(5500);
await hl(page, '', false);
await caption(page, 'Filter across all projects');
await page.click('#q');
for (const ch of 'invoice') { await page.keyboard.type(ch); await sleep(120); }
await sleep(2500);
await page.fill('#q', '');
await page.dispatchEvent('#q', 'input');
await sleep(1500);

// 4. Checkpoint (52-63 s)
await page.setContent(term);
await caption(page, 'Each session ends with CHECKPOINT.md, the next one starts from it');
await type(page, 'director-kit checkpoint ~/Projects/invoice-bot');
await print(page, '<span class="d">created: ~/Projects/invoice-bot/CHECKPOINT.md</span>\n');
await type(page, 'cat ~/Projects/invoice-bot/CHECKPOINT.md');
await print(page, [
  '<span class="h">STATUS:</span> IN_PROGRESS',
  '<span class="h">TASK:</span> Telegram bot that drafts invoices',
  '<span class="h">LAST_ACTION:</span> PDF renders, VAT missing',
  '<span class="h">NEXT:</span> Add VAT field to the PDF',
  '<span class="h">DO_NOT_REDO:</span>',
  '- deploy to staging (done 26.10)',
].join('\n'), 180);
await sleep(4500);

// 5. Audit (63-78 s)
await page.setContent(term);
await caption(page, 'Weekly audit: what to decide, what to restart, what is not backed up');
await type(page, 'director-kit audit');
await print(page, esc(auditMd).replace(/^(#+ .*)$/gm, '<span class="h">$1</span>'), 120);
await sleep(7000);

// 6. End card (78-85 s)
await page.setContent(term);
await page.evaluate(() => { document.getElementById('win').outerHTML = '<div><div class="title">npx director-kit</div><div class="sub">github.com/devladpopov/director-kit<br>MIT, zero dependencies, Node 18+</div></div>'; });
await sleep(6000);

await ctx.close();
await browser.close();
const webm = fs.readdirSync(videoDir).find(f => f.endsWith('.webm'));
const out = path.join(HERE, 'director-kit.webm');
fs.copyFileSync(path.join(videoDir, webm), out);
console.log(out);
