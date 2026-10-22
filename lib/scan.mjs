// Walks a projects root: every subfolder with a CHECKPOINT.md or a .git is a project.
// Works on day zero: without checkpoints the status comes from git activity.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readCheckpoint, statusOf } from './checkpoint.mjs';
import { isDir, subdirs } from './config.mjs';

const DAY = 864e5;

function git(dir, args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).trim();
  } catch {
    return null;
  }
}

export function gitInfo(dir) {
  if (!fs.existsSync(path.join(dir, '.git'))) return null;
  const last = git(dir, ['log', '-1', '--format=%cI%x09%s']);
  const recent = git(dir, ['log', '--no-merges', '--since=30.days', '--format=%H']);
  const hashes = recent ? recent.split('\n').filter(Boolean) : [];
  const dirty = git(dir, ['status', '--porcelain']);
  const remotes = git(dir, ['remote']);
  const ahead = git(dir, ['rev-list', '--count', '@{u}..HEAD']);
  const [lastDate, lastSubject] = last ? last.split('\t') : [null, null];
  return {
    branch: git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']),
    lastCommit: lastDate || null,
    lastSubject: lastSubject || null,
    commits30d: hashes.length,
    worktree: fs.statSync(path.join(dir, '.git')).isFile(), // linked worktree or submodule
    hashes, // dropped from the board; counts unique commits across worktrees
    dirtyFiles: dirty ? dirty.split('\n').filter(Boolean).length : 0,
    hasRemote: !!(remotes && remotes.length),
    unpushed: ahead == null ? null : Number(ahead),
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

export function scanProject(dir, cfg, now = Date.now()) {
  const cp = readCheckpoint(dir);
  const g = gitInfo(dir);
  if (!cp && !g) return null;

  const times = [cp?.mtime, g?.lastCommit && Date.parse(g.lastCommit)].filter(Boolean);
  if (g?.dirtyFiles) times.push(newestMtime(dir));
  const lastActivity = times.length ? Math.max(...times) : null;
  const idleDays = lastActivity ? Math.floor((now - lastActivity) / DAY) : null;

  let status = cp ? statusOf(cp.fields.STATUS) : 'unknown';
  // "NEXT: await user input" means the ball is with you, not that the project is stuck.
  if (cp && status !== 'done' && /^(await|waiting for|blocked on)\b/i.test(cp.fields.NEXT || '')) status = 'waiting';
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

export function scanRoot(root, cfg, now = Date.now()) {
  const skip = new Set(cfg.skip || []);
  const projects = [];
  let folders = 0;
  for (const name of subdirs(root)) {
    if (skip.has(name) || name.startsWith('.')) continue;
    folders++;
    const p = scanProject(path.join(root, name), cfg, now);
    if (p) projects.push(p);
  }
  // A root that is itself a single repo.
  if (!projects.length && isDir(root)) {
    const p = scanProject(root, cfg, now);
    if (p) projects.push(p);
  }
  return { root, folders, projects };
}
