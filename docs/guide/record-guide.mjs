// Records the step-by-step video guide: one clip per step plus the full video.
// Every terminal line is real output of director-kit, run on a throwaway projects folder
// built from examples/checkpoints (sample data only, nothing from your machine).
//   node docs/guide/record-guide.mjs   ->  docs/guide/step-N.webm, then docs/guide/build.sh
// Needs playwright installed globally (npm i -g playwright) and chromium (npx playwright install chromium).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync, execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const globalRoot = process.env.PLAYWRIGHT_ROOT || execSync('npm root -g').toString().trim();
const { chromium } = createRequire(path.join(globalRoot, 'noop.js'))('playwright');

// --- sample projects folder -------------------------------------------------
const DAY = 864e5;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-guide-'));
const projects = path.join(tmp, 'Projects');
const home = path.join(tmp, 'home');
const backups = path.join(tmp, 'Backups', 'nas');
const env = { ...process.env, PATH: [path.join(os.homedir(), '.local', 'bin'), process.env.PATH].join(path.delimiter), DIRECTOR_KIT_HOME: home, CI: '1', GIT_AUTHOR_NAME: 'me', GIT_AUTHOR_EMAIL: 'me@example.com', GIT_COMMITTER_NAME: 'me', GIT_COMMITTER_EMAIL: 'me@example.com' };
const example = (f) => fs.readFileSync(path.join(ROOT, 'examples/checkpoints', f), 'utf8');
const inTwoDays = new Date(Date.now() + 2 * DAY).toISOString().slice(0, 16) + 'Z';

function repo(name, { commits = 3, ageDays = 0, remote = true, checkpoint = null } = {}) {
  const d = path.join(projects, name);
  fs.mkdirSync(d, { recursive: true });
  execFileSync('git', ['-C', d, 'init', '-q', '-b', 'main'], { env });
  if (checkpoint) fs.writeFileSync(path.join(d, 'CHECKPOINT.md'), checkpoint); // committed with the first commit
  for (let i = 0; i < commits; i++) {
    const date = new Date(Date.now() - (ageDays + (commits - i) * 0.3) * DAY).toISOString();
    fs.writeFileSync(path.join(d, `f${i}.txt`), `${name} ${i}`);
    execFileSync('git', ['-C', d, 'add', '.'], { env });
    execFileSync('git', ['-C', d, 'commit', '-q', '-m', `step ${i}`], { env: { ...env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
  }
  if (remote) execFileSync('git', ['-C', d, 'remote', 'add', 'origin', `https://example.invalid/${name}.git`], { env });
  const t = new Date(Date.now() - ageDays * DAY);
  for (const f of fs.readdirSync(d)) if (f !== '.git') fs.utimesSync(path.join(d, f), t, t);
}

repo('invoice-bot', { commits: 9, checkpoint: example('active.md') });
repo('landing-page', { commits: 6, ageDays: 1, checkpoint: example('waiting-on-you.md') });
repo('newsletter', { commits: 2, ageDays: 9, checkpoint: example('scheduled.md').replace(/NOT_BEFORE: .*/, `NOT_BEFORE: ${inTwoDays}`) });
repo('dns-move', { commits: 2, ageDays: 2, checkpoint: example('waiting-for-someone.md') });
repo('home-server', { commits: 4, ageDays: 3, checkpoint: example('done.md') });
repo('crm-lite', { commits: 7, ageDays: 0 });
repo('scraper-jobs', { commits: 12, ageDays: 0 });
repo('tax-2026', { commits: 1, ageDays: 11, remote: false });
repo('course-ai-basics', { commits: 2, ageDays: 15 });
repo('old-game-jam', { commits: 5, ageDays: 140 });
fs.mkdirSync(backups, { recursive: true });
fs.writeFileSync(path.join(backups, 'photos-2026-10-31.tar'), 'x');
const stale = new Date(Date.now() - 52 * 36e5);
fs.utimesSync(path.join(backups, 'photos-2026-10-31.tar'), stale, stale);

// Real CLI output with throwaway paths shown as the user would see them.
const tidy = (s) => s.split(projects).join('~/Projects').split(backups).join('~/Backups/nas').split(home).join('~/.director-kit')
  .split(ROOT).join('~/.npm/_npx/director-kit').replace(/\\/g, '/').trim();
const cli = (...a) => tidy(execFileSync(process.execPath, [path.join(ROOT, 'bin/director-kit.mjs'), ...a, '--no-open'], { env, cwd: tmp }).toString());
const hook = (dir) => tidy(execFileSync(process.execPath, [path.join(ROOT, 'bin/session-start.mjs')], { env: { ...env, CLAUDE_PROJECT_DIR: path.join(projects, dir) } }).toString());
// The board footer and cards carry the real throwaway path; show it as ~/Projects like the terminal does.
function boardUrl() {
  const raw = fs.readFileSync(path.join(home, 'board.html'), 'utf8');
  const shown = [projects, JSON.stringify(projects).slice(1, -1)].reduce((h, p) => h.split(p).join('~/Projects'), raw);
  const f = path.join(home, 'guide-board.html');
  fs.writeFileSync(f, shown);
  return pathToFileURL(f).href;
}

// --- page helpers -------------------------------------------------------------
const W = 1280, H = 720;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const CAPTION = `#cap{position:fixed;left:50%;top:18px;transform:translateX(-50%);max-width:1100px;background:rgba(17,24,39,.92);color:#fff;
font:600 21px/1.35 system-ui,Segoe UI,sans-serif;padding:11px 22px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25);z-index:99;text-align:center}
#cap:empty{display:none}body.board #cap{top:auto;left:auto;right:24px;bottom:24px;transform:none;max-width:560px;text-align:left}
#step{position:fixed;left:18px;bottom:14px;font:600 14px system-ui,sans-serif;color:#8b949e;z-index:99}body.board #step{color:#6b7280}
.hl{outline:3px solid #f59e0b!important;outline-offset:4px;border-radius:10px;transition:outline .2s}`;
const term = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0d1117;color:#e6edf3;font:17px/1.42 Consolas,ui-monospace,monospace;height:100vh;display:flex;align-items:center;justify-content:center}
.win{width:1160px;height:560px;margin-top:56px;background:#161b22;border:1px solid #30363d;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.scr{flex:1;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden}
.bar{height:32px;flex:none;background:#21262d;display:flex;gap:8px;align-items:center;padding:0 14px}.bar i{width:12px;height:12px;border-radius:50%;background:#484f58}
pre{margin:0;padding:18px 24px;white-space:pre-wrap}
.p{color:#7ee787}.d{color:#8b949e}.h{color:#79c0ff;font-weight:700}.c{color:#6e7681;font-style:italic}
.title{font:700 44px/1.25 system-ui,Segoe UI,sans-serif;text-align:center;padding:0 60px}.sub{font:400 25px/1.45 system-ui,sans-serif;color:#8b949e;margin-top:18px;text-align:center}
.kick{font:700 18px system-ui,sans-serif;color:#7ee787;letter-spacing:.12em;text-transform:uppercase;text-align:center;margin-bottom:14px}
${CAPTION}</style><body><div class="win" id="win"><div class="bar"><i></i><i></i><i></i></div><div class="scr"><pre id="o"></pre></div></div><div id="cap"></div><div id="step"></div>`;

async function overlay(page, cap, step) {
  await page.evaluate(([t, s, css]) => {
    if (!document.getElementById('cap')) {
      const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      for (const id of ['cap', 'step']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); }
    }
    document.getElementById('cap').textContent = t;
    if (s != null) document.getElementById('step').textContent = s;
  }, [cap, step ?? null, CAPTION]);
}
async function type(page, cmd) {
  await page.evaluate(() => { document.getElementById('o').insertAdjacentHTML('beforeend', '<span class="p">$ </span>'); });
  for (const ch of cmd) { await page.evaluate((c) => document.getElementById('o').insertAdjacentText('beforeend', c), ch); await sleep(45); }
  await sleep(350);
  await page.evaluate(() => document.getElementById('o').insertAdjacentText('beforeend', '\n'));
}
async function print(page, html, lineMs = 0) {
  for (const line of html.split('\n')) {
    await page.evaluate((l) => document.getElementById('o').insertAdjacentHTML('beforeend', l + '\n'), line);
    if (lineMs) await sleep(lineMs);
  }
}
const out = (s) => `<span class="d">${esc(s)}</span>`;
const md = (s) => esc(s).replace(/^(#+ .*)$/gm, '<span class="h">$1</span>').replace(/\*\*/g, '');
const keys = (s) => esc(s).replace(/^([A-Z_]+:)/gm, '<span class="h">$1</span>');
const hl = (page, sel) => page.evaluate((s) => { document.querySelectorAll('.hl').forEach((e) => e.classList.remove('hl')); if (s) document.querySelectorAll(s).forEach((e) => e.classList.add('hl')); }, sel);
const colOf = (page, re) => page.evaluate((src) => [...document.querySelectorAll('.col h2')].findIndex((h) => new RegExp(src, 'i').test(h.textContent)) + 1, re);
const cardSel = (name) => `.card[data-q^="${name}"]`;

async function titleCard(page, n, total, title, sub) {
  await page.setContent(term);
  await page.evaluate(([k, t, s]) => { document.getElementById('win').outerHTML = `<div><div class="kick">${k}</div><div class="title">${t}</div><div class="sub">${s}</div></div>`; }, [`Step ${n} of ${total}`, title, sub]);
  await sleep(3500);
  await page.setContent(term);
  await overlay(page, '', `director-kit guide · step ${n}/${total}: ${title}`);
}
async function board(page, n, total, title) {
  await page.goto(boardUrl());
  await page.evaluate(() => document.body.classList.add('board'));
  await overlay(page, '', `director-kit guide · step ${n}/${total}: ${title}`);
}

// --- steps ----------------------------------------------------------------------
const T = 6;
const STEPS = [
  ['Check what you have', async (page) => {
    await titleCard(page, 1, T, 'Check what you have', 'Node 18+ and git. Claude Code is optional.');
    await overlay(page, 'doctor checks node, git and claude. Only node is required');
    await type(page, 'npx director-kit doctor');
    await print(page, out(cli('doctor')), 250);
    await sleep(8000);
  }],
  ['Build the board', async (page) => {
    await titleCard(page, 2, T, 'Build the board', 'One command over your whole projects folder');
    await overlay(page, 'Point it at the folder that holds your repos. It asks once, then remembers');
    await type(page, 'npx director-kit --root=~/Projects');
    await print(page, out(cli(`--root=${projects}`, '--yes')), 250);
    await sleep(5000);
    await board(page, 2, T, 'Build the board');
    await overlay(page, 'board.html: one static file, opens from disk, nothing is uploaded');
    await sleep(5500);
    await hl(page, `.col:nth-of-type(${await colOf(page, 'waiting')})`);
    await overlay(page, 'Waiting on you: an agent stopped and needs your decision');
    await sleep(5500);
    await hl(page, `.col:nth-of-type(${await colOf(page, '^active')})`);
    await overlay(page, 'Active: commits or checkpoint edits in the last 7 days');
    await sleep(5000);
    await hl(page, `.col:nth-of-type(${await colOf(page, 'stalled')})`);
    await overlay(page, 'Stalled: in progress, but silent for more than a week');
    await sleep(5000);
    await hl(page, '');
    await overlay(page, 'No CHECKPOINT.md needed on day one: status comes from git history');
    await sleep(5000);
  }],
  ['Read a card', async (page) => {
    await titleCard(page, 3, T, 'Read a card', 'Task, next step, blocker, silence, risks');
    await board(page, 3, T, 'Read a card');
    await hl(page, cardSel('landing-page'));
    await overlay(page, 'From CHECKPOINT.md: the task, the next step and what blocks it');
    await sleep(6500);
    await hl(page, cardSel('newsletter'));
    await overlay(page, 'NOT_BEFORE in the future: paused until then, not stalled');
    await sleep(6000);
    await hl(page, cardSel('dns-move'));
    await overlay(page, 'WAIT_FOR: who or what the work is waiting on');
    await sleep(5500);
    await hl(page, '.pill.risk');
    await overlay(page, 'Red pills: no remote, unpushed commits, uncommitted work');
    await sleep(5500);
    await hl(page, '');
    await overlay(page, 'Filter across every project');
    await page.click('#q');
    for (const ch of 'invoice') { await page.keyboard.type(ch); await sleep(110); }
    await sleep(2500);
    await page.fill('#q', ''); await page.dispatchEvent('#q', 'input');
    await sleep(1000);
  }],
  ['Add a CHECKPOINT', async (page) => {
    await titleCard(page, 4, T, 'Add a CHECKPOINT', 'One file per project: where the work is');
    await overlay(page, 'Create the file from the template. An existing one is never overwritten');
    await type(page, 'director-kit checkpoint ~/Projects/crm-lite');
    await print(page, out(cli('checkpoint', path.join(projects, 'crm-lite'))));
    await sleep(2500);
    const filled = [
      'STATUS: AWAITING_USER',
      'TASK: own CRM instead of a SaaS seat',
      `DATE: ${new Date().toISOString().slice(0, 16)}Z`,
      'LAST_ACTION: 1 240 contacts imported from CSV, 37 duplicates merged',
      'NEXT: await user input',
      'BLOCKER: you: choose which of the 37 merged contacts to keep',
      'DO_NOT_REDO:',
      '- CSV import done (do not import again, it duplicates)',
      'VERIFY_BEFORE_ACT: sqlite3 crm.db "select count(*) from contacts"',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(projects, 'crm-lite', 'CHECKPOINT.md'), filled);
    await overlay(page, 'Claude fills it at the end of each step: done, next, never repeat');
    await type(page, 'cat ~/Projects/crm-lite/CHECKPOINT.md');
    await print(page, keys(filled.trim()), 160);
    await sleep(6000);
    await overlay(page, 'Rebuild: the card moves to "Waiting on you"');
    await type(page, 'director-kit board');
    await print(page, out(cli('board')), 200);
    await sleep(3500);
    await board(page, 4, T, 'Add a CHECKPOINT');
    await hl(page, cardSel('crm-lite'));
    await overlay(page, 'crm-lite now waits on you, with the exact question');
    await sleep(6000);
  }],
  ['Connect Claude Code', async (page) => {
    await titleCard(page, 5, T, 'Connect Claude Code', 'The plugin shows the checkpoint before the first message');
    await overlay(page, 'Once per machine: add the marketplace and install the plugin');
    await type(page, 'claude plugin marketplace add devladpopov/director-kit');
    await type(page, 'claude plugin install director-kit@director-kit');
    await print(page, '<span class="c"># adds a SessionStart hook, 3 skills and /director-kit:board, :audit, :checkpoint</span>\n');
    await sleep(4500);
    await overlay(page, 'This is what Claude reads first in crm-lite, before you type anything');
    await print(page, '<span class="c"># SessionStart hook output, real:</span>');
    await print(page, keys(hook('crm-lite')), 170);
    await sleep(7000);
    await overlay(page, 'In a finished project it is told to stop, not to redo the work');
    await print(page, '\n<span class="c"># the same hook in home-server (STATUS: COMPLETED):</span>');
    await print(page, keys(hook('home-server').split('\n').slice(-1)[0]));
    await sleep(6000);
  }],
  ['Audit and backups', async (page) => {
    await titleCard(page, 6, T, 'Audit and backups', 'What to decide, what to restart, what is not safe');
    await overlay(page, 'Watch a backup folder: the audit flags it when the newest file is too old');
    await type(page, 'director-kit backup add ~/Backups/nas --name=nas --max-age=26');
    await print(page, out(cli('backup', 'add', backups, '--name=nas', '--max-age=26')));
    await sleep(3000);
    await overlay(page, 'One report, waiting on you first. Run it daily from your scheduler');
    await type(page, 'director-kit audit');
    await print(page, md(cli('audit').split('\nsaved:')[0].split('\n## Memory')[0].trim()), 110);
    await sleep(8000);
    await page.setContent(term);
    await overlay(page, 'Daily at 08:00: Task Scheduler on Windows, cron on macOS and Linux', `director-kit guide · step 6/${T}: Audit and backups`);
    await print(page, '<span class="c"># Windows</span>');
    await type(page, 'schtasks /Create /SC DAILY /ST 08:00 /TN director-kit-audit /TR "cmd /c npx -y director-kit audit --no-open"');
    await print(page, '\n<span class="c"># macOS, Linux: crontab -e</span>');
    await print(page, '0 8 * * * /usr/local/bin/npx -y director-kit audit --no-open');
    await sleep(5500);
    await page.setContent(term);
    await page.evaluate(() => { document.getElementById('win').outerHTML = '<div><div class="title">npx director-kit</div><div class="sub">github.com/devladpopov/director-kit<br>MIT, zero dependencies, Node 18+. Nothing leaves your machine.</div></div>'; });
    await sleep(5000);
  }],
];

// --- record -----------------------------------------------------------------------
const only = process.argv[2] ? Number(process.argv[2]) : null;
if (only > 2) cli(`--root=${projects}`, '--yes'); // later steps need the board from step 2
// CHROMIUM=<path to chrome> if the global playwright expects a browser build you do not have.
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
try {
  for (const [i, [title, run]] of STEPS.entries()) {
    if (only && only !== i + 1) continue;
    const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-rec-'));
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'light', recordVideo: { dir: videoDir, size: { width: W, height: H } } });
    const page = await ctx.newPage();
    await run(page);
    await ctx.close();
    const webm = fs.readdirSync(videoDir).find((f) => f.endsWith('.webm'));
    const dest = path.join(HERE, `step-${i + 1}.webm`);
    fs.copyFileSync(path.join(videoDir, webm), dest);
    console.log(`step ${i + 1}: ${title} -> ${dest}`);
  }
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
