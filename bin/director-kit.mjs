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
import { renderAudit } from '../lib/audit.mjs';
import { checkpointTemplate } from '../lib/checkpoint.mjs';
import { demoScan } from '../lib/demo.mjs';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const pos = argv.filter((a) => !a.startsWith('--'));
const cmd = pos[0] && !isDir(pos[0]) ? pos.shift() : 'init';

const HELP = `director-kit: one board over all your projects

  director-kit [root]           first run: pick projects folder, build board, open it
  director-kit board            rebuild board (~/.director-kit/board.html)
  director-kit audit            markdown audit: waiting on you, stalled, not backed up
  director-kit checkpoint [dir] create CHECKPOINT.md from template (does not overwrite)
  director-kit doctor           check node, git, claude
  director-kit demo             board with sample data (for screenshots)

  --no-open   do not open the browser      --json   print board json
  --private   no absolute paths in board   --root=<dir>  projects folder
`;

const has = (bin) => { try { execFileSync(bin, ['--version'], { stdio: 'ignore', timeout: 10000, shell: process.platform === 'win32' }); return true; } catch { return false; } };
const flagVal = (k) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : null; };

function open(file) {
  if (flags.has('--no-open') || process.env.CI) return;
  const [c, a] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]] : process.platform === 'darwin' ? ['open', [file]] : ['xdg-open', [file]];
  try { spawn(c, a, { stdio: 'ignore', detached: true }).unref(); } catch {}
}

function build(cfg, scan) {
  const board = buildBoard(scan || scanRoot(cfg.root, cfg), { privatePaths: flags.has('--private') });
  const out = writeBoard(board, HOME);
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
  const { out, board } = build(cfg);
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
  board() { const cfg = needRoot(); open(build(cfg).out.html); },
  audit() {
    const cfg = needRoot();
    const { board } = build(cfg);
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
    console.log(`kit ${KIT}`);
  },
  demo() { const cfg = loadConfig(); open(build(cfg, demoScan()).out.html); },
  help() { console.log(HELP); },
};

function needRoot() {
  const cfg = loadConfig();
  if (flagVal('root')) cfg.root = path.resolve(flagVal('root'));
  if (!cfg.root) { console.error('no projects folder yet: run "director-kit" first'); process.exit(1); }
  return cfg;
}

if (flags.has('--help') || cmd === '-h') cmds.help();
else if (!cmds[cmd]) { console.error(`unknown command: ${cmd}\n`); cmds.help(); process.exit(1); }
else await cmds[cmd]();
