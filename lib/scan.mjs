// Walks a projects root: every subfolder with a CHECKPOINT.md or a .git is a project.
// Works on day zero: without checkpoints the status comes from git activity.
// Git is the slow part, so projects are scanned in parallel and each needs only 4 git calls.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { readCheckpoint, statusOf } from './checkpoint.mjs';
import { isDir, subdirs } from './config.mjs';

const DAY = 864e5;

const git = (dir, args) => new Promise((resolve) => {
  execFile('git', ['-C', dir, ...args], { encoding: 'utf8', timeout: 15000, maxBuffer: 64 << 20, windowsHide: true },
    (err, out) => resolve(err ? null : out.trim()));
});

export async function gitInfo(dir) {
  if (!fs.existsSync(path.join(dir, '.git'))) return null;
  const [last, recent, status, remotes] = await Promise.all([
    git(dir, ['log', '-1', '--format=%cI%x09%s']),
    git(dir, ['log', '--no-merges', '--since=30.days', '--format=%H']),
    git(dir, ['status', '--porcelain=v2', '--branch']), // branch, ahead of upstream and dirty files in one call
    git(dir, ['remote']),
  ]);
  const hashes = recent ? recent.split('\n').filter(Boolean) : [];
  const lines = status ? status.split('\n').filter(Boolean) : [];
  const header = (k) => lines.find((l) => l.startsWith(`# branch.${k} `))?.slice(`# branch.${k} `.length) ?? null;
  const ab = /^\+(\d+) -\d+$/.exec(header('ab') || '');
  const [lastDate, lastSubject] = last ? last.split('\t') : [null, null];
  return {
    branch: header('head') === '(detached)' ? 'HEAD' : header('head'),
    lastCommit: lastDate || null,
    lastSubject: lastSubject || null,
    commits30d: hashes.length,
    worktree: fs.statSync(path.join(dir, '.git')).isFile(), // linked worktree or submodule
    hashes, // dropped from the board; counts unique commits across worktrees
    dirtyFiles: lines.filter((l) => !l.startsWith('#')).length,
    hasRemote: !!(remotes && remotes.length),
    unpushed: ab ? Number(ab[1]) : null,
  };
}

function firstHeading(dir) {
  for (const f of ['README.md', 'readme.md', 'README']) {
    try {
      const m = /^#\s+(.+)$/m.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (m) return m[1].trim();
    } catch {}
  }
  return null;
}

export async function scanProject(dir, cfg, now = Date.now()) {
  const cp = readCheckpoint(dir);
  const g = await gitInfo(dir);
  if (!cp && !g) return null;

  const times = [cp?.mtime, g?.lastCommit && Date.parse(g.lastCommit)].filter(Boolean);
  if (g?.dirtyFiles) times.push(newestMtime(dir));
  const lastActivity = times.length ? Math.max(...times) : null;
  const idleDays = lastActivity ? Math.floor((now - lastActivity) / DAY) : null;

  let status = cp ? statusOf(cp.fields.STATUS) : 'unknown';
  // "NEXT: await user input" means the ball is with you, not that the project is stuck.
  if (cp && status !== 'done' && /^(await|waiting for|blocked on)\b/i.test(cp.fields.NEXT || '')) status = 'waiting';
  // "BLOCKER: you: approve copy" (or user: / owner:) also puts the ball with you.
  if (cp && status !== 'done' && /^(you|user|owner)\s*:/i.test(cp.fields.BLOCKER || '')) status = 'waiting';
  // "NOT_BEFORE: <future date>": the next step is scheduled, so silence is expected, not a stall.
  const notBefore = Date.parse(cp?.fields.NOT_BEFORE || '');
  const scheduled = notBefore > now ? new Date(notBefore).toISOString() : null;
  if (scheduled && status === 'active') status = 'paused';
  if (status === 'unknown') status = idleDays == null || idleDays > cfg.dormantDays ? 'dormant' : 'active';
  if (status === 'active' && idleDays != null && idleDays > cfg.activeDays) status = idleDays > cfg.dormantDays && !cp ? 'dormant' : 'stalled';

  const risks = [];
  if (g && !g.hasRemote) risks.push('no remote: not backed up');
  if (g?.unpushed) risks.push(`${g.unpushed} unpushed commit${g.unpushed > 1 ? 's' : ''}`);
  if (g?.dirtyFiles && idleDays != null && idleDays > 2) risks.push(`${g.dirtyFiles} uncommitted file${g.dirtyFiles > 1 ? 's' : ''} for ${idleDays}d`);

  const f = cp?.fields || {};
  return {
    name: path.basename(dir),
    title: firstHeading(dir),
    path: dir,
    status,
    hasCheckpoint: !!cp,
    task: f.TASK || null,
    next: f.NEXT || null,
    lastAction: f.LAST_ACTION || g?.lastSubject || null,
    blocker: f.BLOCKER && !/^(none|no|-|n\/a)$/i.test(f.BLOCKER) ? f.BLOCKER : null,
    waitFor: f.WAIT_FOR || null,
    notBefore: scheduled,
    progress: /^\d{1,3}/.test(f.PROGRESS || '') ? Math.min(100, parseInt(f.PROGRESS, 10)) : null,
    lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
    idleDays,
    git: g,
    risks,
  };
}

// Newest mtime among top-level files (cheap proxy for "someone is editing right now").
function newestMtime(dir) {
  let max = 0;
  for (const f of safeList(dir)) {
    if (f.startsWith('.')) continue;
    try { max = Math.max(max, fs.statSync(path.join(dir, f)).mtimeMs); } catch {}
  }
  return max || null;
}
const safeList = (d) => { try { return fs.readdirSync(d); } catch { return []; } };

// Runs fn over items with at most `limit` in flight, keeps order.
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function scanRoot(root, cfg, now = Date.now()) {
  const skip = new Set(cfg.skip || []);
  const dirs = subdirs(root).filter((name) => !skip.has(name) && !name.startsWith('.')).map((name) => path.join(root, name));
  const limit = cfg.concurrency || Math.max(4, Math.min(16, (os.availableParallelism?.() || os.cpus().length) * 2));
  const projects = (await pool(dirs, limit, (d) => scanProject(d, cfg, now))).filter(Boolean);
  // A root that is itself a single repo.
  if (!projects.length && isDir(root)) {
    const p = await scanProject(root, cfg, now);
    if (p) projects.push(p);
  }
  return { root, folders: dirs.length, projects };
}
