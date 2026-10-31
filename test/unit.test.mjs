// Unit tests for the pure parts: checkpoint parsing, status rules, board summary, audit, html.
// node --test test/   (no dependencies; git repos are only needed by smoke.mjs)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCheckpoint, statusOf, checkpointTemplate } from '../lib/checkpoint.mjs';
import { scanProject } from '../lib/scan.mjs';
import { buildBoard, renderHtml } from '../lib/board.mjs';
import { renderAudit, backupFindings, newestFile } from '../lib/audit.mjs';
import { demoScan } from '../lib/demo.mjs';
import { DEFAULTS } from '../lib/config.mjs';

const DAY = 864e5;
const NOW = Date.parse('2026-11-01T12:00:00Z');

// A folder with only a CHECKPOINT.md (no git), mtime set to `ageDays` before NOW.
function cpDir(text, ageDays = 0) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-unit-'));
  const f = path.join(d, 'CHECKPOINT.md');
  fs.writeFileSync(f, text);
  const t = new Date(NOW - ageDays * DAY);
  fs.utimesSync(f, t, t);
  return d;
}
const scan = async (text, ageDays) => {
  const d = cpDir(text, ageDays);
  try { return await scanProject(d, DEFAULTS, NOW); } finally { fs.rmSync(d, { recursive: true, force: true }); }
};

test('parseCheckpoint: first occurrence wins, BOM and CRLF are fine', () => {
  const { fields } = parseCheckpoint('﻿STATUS: IN_PROGRESS\r\nTASK: a\r\nTASK: b\r\n');
  assert.equal(fields.STATUS, 'IN_PROGRESS');
  assert.equal(fields.TASK, 'a');
});

test('parseCheckpoint: DO_NOT_REDO collects the list until the next field or text', () => {
  const { lists, fields } = parseCheckpoint('DO_NOT_REDO:\n- one\n* two\n  - three\nNEXT: go\n- not in list\n');
  assert.deepEqual(lists.DO_NOT_REDO, ['one', 'two', 'three']);
  assert.equal(fields.NEXT, 'go');
});

test('parseCheckpoint: lowercase keys and prose are ignored', () => {
  const { fields } = parseCheckpoint('status: done\nSome text: here\nSTATUS: COMPLETED\n');
  assert.deepEqual(Object.keys(fields), ['STATUS']);
});

test('statusOf maps common spellings', () => {
  const cases = {
    'COMPLETED': 'done', 'done': 'done', 'SHIPPED (v2)': 'done',
    'IN_PROGRESS': 'active', 'WIP': 'active', 'COMPLETED | IN_PROGRESS': 'done',
    'AWAITING_REVIEW': 'waiting', 'BLOCKED': 'waiting',
    'PAUSED': 'paused', 'ON_HOLD': 'paused', 'NOT_STARTED': 'paused',
    '': 'unknown', 'whatever': 'unknown',
  };
  for (const [raw, want] of Object.entries(cases)) assert.equal(statusOf(raw), want, raw);
});

test('checkpointTemplate parses back into the protocol fields', () => {
  const { fields, lists } = parseCheckpoint(checkpointTemplate({ task: 'ship', date: '2026-11-01' }));
  assert.equal(fields.STATUS, 'IN_PROGRESS');
  assert.equal(fields.TASK, 'ship');
  assert.equal(fields.BLOCKER, 'none');
  assert.equal(lists.DO_NOT_REDO.length, 1);
  assert.ok(fields.VERIFY_BEFORE_ACT);
});

test('status: NEXT await user input means waiting on you', async () => {
  assert.equal((await scan('STATUS: IN_PROGRESS\nNEXT: await user input\n')).status, 'waiting');
  assert.equal((await scan('STATUS: IN_PROGRESS\nNEXT: Waiting for the client\n')).status, 'waiting');
});

test('status: BLOCKER you: means waiting, BLOCKER none does not', async () => {
  const p = await scan('STATUS: IN_PROGRESS\nBLOCKER: you: approve copy\n');
  assert.equal(p.status, 'waiting');
  assert.equal(p.blocker, 'you: approve copy');
  const q = await scan('STATUS: IN_PROGRESS\nBLOCKER: none\n');
  assert.equal(q.status, 'active');
  assert.equal(q.blocker, null);
});

test('status: COMPLETED stays done even when NEXT says await', async () => {
  assert.equal((await scan('STATUS: COMPLETED\nNEXT: await user input\n')).status, 'done');
});

test('status: in progress but silent past activeDays is stalled, never dormant', async () => {
  assert.equal((await scan('STATUS: IN_PROGRESS\n', 3)).status, 'active');
  assert.equal((await scan('STATUS: IN_PROGRESS\n', 10)).status, 'stalled');
  assert.equal((await scan('STATUS: IN_PROGRESS\n', 90)).status, 'stalled');
});

test('status: NOT_BEFORE in the future is paused (scheduled), in the past changes nothing', async () => {
  const p = await scan('STATUS: IN_PROGRESS\nNOT_BEFORE: 2026-11-05T08:30Z\n', 10);
  assert.equal(p.status, 'paused');
  assert.equal(p.notBefore, '2026-11-05T08:30:00.000Z');
  const q = await scan('STATUS: IN_PROGRESS\nNOT_BEFORE: 2026-10-01T08:30Z\n', 10);
  assert.equal(q.status, 'stalled');
  assert.equal(q.notBefore, null);
});

test('scan: WAIT_FOR and PROGRESS reach the card', async () => {
  const p = await scan('STATUS: IN_PROGRESS\nWAIT_FOR: reply from topic 96521\nPROGRESS: 140%\n');
  assert.equal(p.waitFor, 'reply from topic 96521');
  assert.equal(p.progress, 100);
});

test('scan: a folder with neither git nor CHECKPOINT is not a project', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-unit-'));
  try { assert.equal(await scanProject(d, DEFAULTS, NOW), null); } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('board: commits counted once across worktrees that share hashes', () => {
  const p = (name, hashes) => ({ name, status: 'active', hasCheckpoint: false, risks: [], git: { commits30d: hashes.length, hashes } });
  const b = buildBoard({ root: '/x', projects: [p('main', ['a', 'b', 'c']), p('main-wt', ['a', 'b', 'c', 'd'])] });
  assert.equal(b.summary.commits30d, 4);
  assert.equal(b.projects[0].git.hashes, undefined);
});

test('board: --private drops absolute paths', () => {
  const b = buildBoard(demoScan(NOW), { privatePaths: true });
  assert.ok(b.projects.every((p) => p.path === undefined));
  assert.ok(!b.root.includes('/'));
});

test('board html: project text cannot break out of the data script', () => {
  const s = demoScan(NOW);
  s.projects[0].task = '</script><img src=x onerror=alert(1)>';
  const html = renderHtml(buildBoard(s));
  assert.ok(!html.includes('</script><img'));
  assert.equal(html.match(/<\/script>/g).length, 2);
});

test('audit: waiting first, stalled sorted by silence, backup hint when none', () => {
  const md = renderAudit(buildBoard(demoScan(NOW)), { ...DEFAULTS, backups: [] }, NOW).markdown;
  const iw = md.indexOf('## Waiting on you'), is = md.indexOf('## Stalled');
  assert.ok(iw > 0 && is > iw);
  assert.ok(md.indexOf('course-ai-basics') < md.indexOf('tax-2026'), 'longest silence first');
  assert.match(md, /director-kit backup add/);
});

test('backups: newest file decides, missing folder is stale', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dk-bk-'));
  try {
    fs.mkdirSync(path.join(d, 'a', 'b'), { recursive: true });
    const old = path.join(d, 'old.tar'), deep = path.join(d, 'a', 'b', 'new.tar');
    fs.writeFileSync(old, 'x'); fs.writeFileSync(deep, 'x');
    fs.utimesSync(old, new Date(NOW - 100 * 36e5), new Date(NOW - 100 * 36e5));
    fs.utimesSync(deep, new Date(NOW - 2 * 36e5), new Date(NOW - 2 * 36e5));
    assert.equal(newestFile(d).path, deep);
    const [ok, gone] = backupFindings([{ name: 'nas', path: d, maxAgeHours: 26 }, { path: path.join(d, 'nope') }], NOW);
    assert.equal(ok.ok, true);
    assert.equal(ok.ageHours, 2);
    assert.equal(gone.ok, false);
    assert.equal(gone.ageHours, null);
    assert.equal(gone.maxAgeHours, 26);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('examples/checkpoints land in the columns examples/README.md promises', async () => {
  const dir = new URL('../examples/checkpoints/', import.meta.url);
  const want = { 'active.md': 'active', 'waiting-on-you.md': 'waiting', 'scheduled.md': 'paused', 'waiting-for-someone.md': 'active', 'done.md': 'done' };
  for (const [f, status] of Object.entries(want)) assert.equal((await scan(fs.readFileSync(new URL(f, dir), 'utf8'))).status, status, f);
});
