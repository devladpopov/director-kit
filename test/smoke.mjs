// End-to-end smoke test on a throwaway projects folder: real git repos, real CLI, no network.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-'));
const root = path.join(tmp, 'Projects');
const home = path.join(tmp, 'home');
const env = { ...process.env, DIRECTOR_KIT_HOME: home, CI: '1', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const run = (args, cwd = tmp) => execFileSync(process.execPath, [path.join(KIT, 'bin/director-kit.mjs'), ...args], { cwd, env, encoding: 'utf8' });
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { env, stdio: 'ignore' });

function repo(name, { checkpoint, commits = 1, ageDays = 0, remote = false } = {}) {
  const d = path.join(root, name);
  fs.mkdirSync(d, { recursive: true });
  git(d, 'init', '-q');
  const date = new Date(Date.now() - ageDays * 864e5).toISOString();
  for (let i = 0; i < commits; i++) {
    fs.writeFileSync(path.join(d, `f${i}.txt`), `${name} ${i}`);
    git(d, 'add', '.');
    execFileSync('git', ['-C', d, 'commit', '-q', '-m', `c${i}`], { env: { ...env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }, stdio: 'ignore' });
  }
  if (remote) git(d, 'remote', 'add', 'origin', 'https://example.invalid/x.git');
  if (checkpoint) {
    fs.writeFileSync(path.join(d, 'CHECKPOINT.md'), checkpoint);
  }
  const t = new Date(Date.now() - ageDays * 864e5);
  for (const f of fs.readdirSync(d)) if (f !== '.git') fs.utimesSync(path.join(d, f), t, t);
  return d;
}

try {
  repo('fresh', { commits: 3, remote: true });
  repo('old', { commits: 1, ageDays: 90, remote: true });
  repo('quiet', { commits: 1, ageDays: 12, remote: true, checkpoint: 'STATUS: IN_PROGRESS\nTASK: ship v2\nNEXT: write docs\n' });
  repo('needs-me', { remote: true, checkpoint: 'STATUS: IN_PROGRESS\nTASK: launch\nNEXT: await user input (approve copy)\n' });
  repo('finished', { remote: true, checkpoint: '﻿STATUS: COMPLETED\nTASK: done thing\nDO_NOT_REDO:\n- migration applied\n' });
  repo('local-only', { commits: 2 });
  fs.mkdirSync(path.join(root, 'just-a-folder'));

  assert.match(run(['--version']), /^\d+\.\d+\.\d+\s*$/);
  const out = run([`--root=${root}`, '--no-open', '--yes']);
  assert.match(out, /6 projects, 8 commits in 30 days/);
  const board = JSON.parse(fs.readFileSync(path.join(home, 'board.json'), 'utf8'));
  const st = Object.fromEntries(board.projects.map((p) => [p.name, p.status]));
  assert.deepEqual(st, { fresh: 'active', old: 'dormant', quiet: 'stalled', 'needs-me': 'waiting', finished: 'done', 'local-only': 'active' });
  assert.ok(board.projects.find((p) => p.name === 'local-only').risks.some((r) => /no remote/.test(r)));
  assert.ok(fs.readFileSync(path.join(home, 'board.html'), 'utf8').includes('needs-me'));

  const audit = run(['audit', '--no-open']);
  assert.match(audit, /## Waiting on you \(1\)/);
  assert.match(audit, /\*\*quiet\*\*: silent 12d/);
  assert.match(audit, /local-only\*\*: no remote/);

  // SessionStart hook: COMPLETED must say "do not repeat".
  const hook = execFileSync(process.execPath, [path.join(KIT, 'bin/session-start.mjs')], { env: { ...env, CLAUDE_PROJECT_DIR: path.join(root, 'finished') }, encoding: 'utf8' });
  assert.match(hook, /COMPLETED\. Do not repeat it/);
  assert.match(hook, /- migration applied/);

  const cp = run(['checkpoint', path.join(root, 'fresh')]);
  assert.match(cp, /created/);
  assert.match(run(['checkpoint', path.join(root, 'fresh')]), /exists, not touched/);

  // Backup watch via CLI: fresh folder OK, old one STALE, rm removes it.
  const fresh = path.join(tmp, 'bk-fresh');
  const stale = path.join(tmp, 'bk-stale');
  fs.mkdirSync(fresh); fs.writeFileSync(path.join(fresh, 'a.tar'), 'x');
  fs.mkdirSync(stale); fs.writeFileSync(path.join(stale, 'b.tar'), 'x');
  const old = new Date(Date.now() - 50 * 36e5);
  fs.utimesSync(path.join(stale, 'b.tar'), old, old);
  assert.match(run(['backup', 'add', fresh, '--name=nas']), /added: nas/);
  assert.match(run(['backup', 'add', stale, '--max-age=24']), /added: bk-stale/);
  assert.match(run(['backup', 'add', stale, '--max-age=72']), /updated: bk-stale/);
  run(['backup', 'add', stale, '--max-age=24']);
  const bl = run(['backup', 'list']);
  assert.match(bl, /OK +nas/);
  assert.match(bl, /STALE bk-stale: 50h old/);
  assert.match(run(['audit', '--no-open']), /STALE \*\*bk-stale\*\*/);
  assert.match(run(['backup', 'rm', 'nas']), /removed: nas/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8')).backups.length, 1);

  // Demo goes to its own folder and must leave the real board untouched (bug in 0.2.0).
  const realBoard = fs.readFileSync(path.join(home, 'board.json'), 'utf8');
  assert.match(run(['demo', '--no-open']), /projects, \d+ commits in 30 days/);
  assert.equal(fs.readFileSync(path.join(home, 'board.json'), 'utf8'), realBoard);
  assert.match(JSON.parse(fs.readFileSync(path.join(home, 'demo', 'board.json'), 'utf8')).root, /\(demo\)/);
  assert.ok(fs.existsSync(path.join(home, 'demo', 'board.html')));
  console.log('smoke: all checks passed');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
