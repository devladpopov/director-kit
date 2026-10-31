#!/usr/bin/env node
// director-kit: a board over all your projects in one command.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig, saveConfig, guessRoot, isDir, HOME, CONFIG_PATH } from '../lib/config.mjs';
import { scanRoot } from '../lib/scan.mjs';
import { buildBoard, writeBoard } from '../lib/board.mjs';
import { renderAudit, backupFindings } from '../lib/audit.mjs';
import { checkpointTemplate } from '../lib/checkpoint.mjs';
import { demoScan } from '../lib/demo.mjs';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const pos = argv.filter((a) => !a.startsWith('--'));
const COMMANDS = ['init', 'board', 'audit', 'checkpoint', 'doctor', 'demo', 'backup', 'help', 'version'];
const cmd = pos[0] && (COMMANDS.includes(pos[0]) || !isDir(pos[0])) ? pos.shift() : 'init';

const HELP = `director-kit: one board over all your projects

  director-kit [root]           first run: pick projects folder, build board, open it
  director-kit board            rebuild board (~/.director-kit/board.html)
  director-kit audit            markdown audit: waiting on you, stalled, not backed up
  director-kit checkpoint [dir] create CHECKPOINT.md from template (does not overwrite)
  director-kit doctor           check node, git, claude
  director-kit demo             board with sample data (~/.director-kit/demo/, for screenshots)
  director-kit backup add <path> [--name=photos] [--max-age=26]
  director-kit backup list | rm <name|path>   folders the audit watches
  director-kit version          print the version

  --no-open   do not open the browser      --json   print board json
  --private   no absolute paths in board   --root=<dir>  projects folder
`;

const VERSION = JSON.parse(fs.readFileSync(path.join(KIT, 'package.json'), 'utf8')).version;
const has = (bin) => { try { execFileSync(bin, ['--version'], { stdio: 'ignore', timeout: 10000, shell: process.platform === 'win32' }); return true; } catch { return false; } };
const flagVal = (k) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : null; };

function open(file) {
  if (flags.has('--no-open') || process.env.CI) return;
  const [c, a] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]] : process.platform === 'darwin' ? ['open', [file]] : ['xdg-open', [file]];
  try { spawn(c, a, { stdio: 'ignore', detached: true }).unref(); } catch {}
}

async function build(cfg, scan, outDir = HOME) {
  const board = buildBoard(scan || await scanRoot(cfg.root, cfg), { privatePaths: flags.has('--private') });
  const out = writeBoard(board, outDir);
  if (flags.has('--json')) console.log(JSON.stringify(board, null, 2));
  const S = board.summary;
  console.log(`${S.total} projects, ${S.commits30d} commits in 30 days | waiting on you ${S.waiting}, active ${S.active}, stalled ${S.stalled}, done ${S.done}, dormant ${S.dormant}, at risk ${S.atRisk}`);
  console.log(`board: ${out.html}`);
  return { board, out };
}

async function ask(q, dflt) {
  if (!process.stdin.isTTY || flags.has('--yes')) return dflt;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${q} [${dflt}] `)).trim();
  rl.close();
  return a || dflt;
}

async function init() {
  const cfg = loadConfig();
  let root = flagVal('root') || pos[0] || cfg.root;
  if (!root) root = await ask('Projects folder:', guessRoot());
  root = path.resolve(root);
  if (!isDir(root)) { console.error(`not a folder: ${root}`); process.exit(1); }
  cfg.root = root;
  const saved = saveConfig(cfg);
  console.log(`config: ${saved}`);
  const { out, board } = await build(cfg);
  if (!board.summary.total) console.log(`no projects found in ${root}: a project is a subfolder with .git or CHECKPOINT.md`);
  open(out.html);
  if (has('claude')) {
    console.log('\nClaude Code found. Add the protocol (CHECKPOINT, memory floors, /audit) to every session:');
    console.log('  claude plugin marketplace add devladpopov/director-kit');
    console.log('  claude plugin install director-kit@director-kit');
  }
}

const cmds = {
  init,
  async board() { const cfg = needRoot(); open((await build(cfg)).out.html); },
  async audit() {
    const cfg = needRoot();
    const { board } = await build(cfg);
    const { markdown } = renderAudit(board, cfg);
    const dir = path.join(HOME, 'audits');
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `audit-${new Date().toISOString().slice(0, 10)}.md`);
    fs.writeFileSync(f, markdown);
    console.log('\n' + markdown + `\nsaved: ${f}`);
  },
  checkpoint() {
    const dir = path.resolve(pos[0] || process.cwd());
    const f = path.join(dir, 'CHECKPOINT.md');
    if (fs.existsSync(f)) { console.log(`exists, not touched: ${f}`); return; }
    fs.writeFileSync(f, checkpointTemplate());
    console.log(`created: ${f}`);
  },
  doctor() {
    const v = process.versions.node.split('.').map(Number);
    console.log(`node ${process.versions.node} ${v[0] >= 18 ? 'OK' : 'FAIL: need 18+'}`);
    console.log(`git ${has('git') ? 'OK' : 'missing: projects without CHECKPOINT.md will not be detected'}`);
    console.log(`claude ${has('claude') ? 'OK' : 'not found (optional: the board works without it)'}`);
    const cfg = loadConfig();
    console.log(`config ${fs.existsSync(CONFIG_PATH) ? CONFIG_PATH + ' root=' + cfg.root : 'none yet: run director-kit'}`);
    console.log(`kit ${KIT} (${VERSION})`);
  },
  // Separate folder: the demo must never overwrite the real board.
  async demo() { const cfg = loadConfig(); open((await build(cfg, demoScan(), path.join(HOME, 'demo'))).out.html); },
  backup,
  help() { console.log(HELP); },
  version() { console.log(VERSION); },
};

// Backup watch: the audit flags a folder whose newest file is older than maxAgeHours.
function backup() {
  const [sub = 'list', target] = pos;
  const cfg = loadConfig();
  const list = cfg.backups || [];
  if (sub === 'add') {
    if (!target) { console.error('usage: director-kit backup add <path> [--name=...] [--max-age=hours]'); process.exit(1); }
    const p = path.resolve(target);
    if (!fs.existsSync(p)) console.log(`note: ${p} does not exist yet, the audit will report it as STALE until it does`);
    const maxAgeHours = Number(flagVal('max-age') || 26);
    if (!(maxAgeHours > 0)) { console.error('--max-age must be a number of hours'); process.exit(1); }
    const entry = { name: flagVal('name') || path.basename(p), path: p, maxAgeHours };
    const i = list.findIndex((b) => path.resolve(b.path) === p);
    if (i >= 0) list[i] = entry; else list.push(entry);
    cfg.backups = list;
    saveConfig(cfg);
    console.log(`${i >= 0 ? 'updated' : 'added'}: ${entry.name} (${p}), limit ${maxAgeHours}h`);
  } else if (sub === 'rm' || sub === 'remove') {
    const keep = list.filter((b) => b.name !== target && path.resolve(b.path) !== path.resolve(target || ''));
    if (!target || keep.length === list.length) { console.error(`no backup named or at: ${target}`); process.exit(1); }
    cfg.backups = keep;
    saveConfig(cfg);
    console.log(`removed: ${target}`);
  } else if (sub === 'list') {
    if (!list.length) { console.log('no backups watched yet: director-kit backup add <path>'); return; }
    for (const b of backupFindings(list)) console.log(`${b.ok ? 'OK   ' : 'STALE'} ${b.name}: ${b.ageHours == null ? 'nothing found' : b.ageHours + 'h old'} (limit ${b.maxAgeHours}h) ${b.path}`);
  } else { console.error(`unknown: backup ${sub}`); process.exit(1); }
}

function needRoot() {
  const cfg = loadConfig();
  if (flagVal('root')) cfg.root = path.resolve(flagVal('root'));
  if (!cfg.root) { console.error('no projects folder yet: run "director-kit" first'); process.exit(1); }
  return cfg;
}

if (flags.has('--help') || cmd === '-h') cmds.help();
else if (flags.has('--version') || cmd === '-v') cmds.version();
else if (!cmds[cmd]) { console.error(`unknown command: ${cmd}\n`); cmds.help(); process.exit(1); }
else await cmds[cmd]();
