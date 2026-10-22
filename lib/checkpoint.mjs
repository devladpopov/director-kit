// CHECKPOINT.md protocol: plain "KEY: value" lines, first occurrence wins.
// List fields (DO_NOT_REDO) collect the "- item" lines that follow them.
import fs from 'node:fs';
import path from 'node:path';

export const FIELDS = ['STATUS', 'TASK', 'DATE', 'LAST_ACTION', 'NEXT', 'BLOCKER', 'PROGRESS', 'STAGE', 'GOAL', 'METRIC', 'VERIFY_BEFORE_ACT'];
const LIST_FIELDS = new Set(['DO_NOT_REDO']);

export function parseCheckpoint(text) {
  const fields = {};
  const lists = {};
  let list = null;
  for (const raw of String(text).replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^([A-Z][A-Z_]{1,24}):[ \t]*(.*)$/.exec(raw);
    if (m) {
      list = LIST_FIELDS.has(m[1]) ? (lists[m[1]] ||= []) : null;
      if (!(m[1] in fields)) fields[m[1]] = m[2].trim();
      continue;
    }
    const item = /^\s*[-*]\s+(.+)$/.exec(raw);
    if (list && item) list.push(item[1].trim());
    else if (raw.trim()) list = null;
  }
  return { fields, lists };
}

export function readCheckpoint(dir) {
  const p = path.join(dir, 'CHECKPOINT.md');
  try {
    const text = fs.readFileSync(p, 'utf8');
    return { path: p, mtime: fs.statSync(p).mtimeMs, ...parseCheckpoint(text) };
  } catch {
    return null;
  }
}

// Normalised status: done | waiting | active | paused | unknown
export function statusOf(raw) {
  const s = String(raw || '').trim().split(/[\s(|]/)[0].toUpperCase();
  if (!s) return 'unknown';
  if (/^(COMPLETED|DONE|SHIPPED|CLOSED)$/.test(s)) return 'done';
  if (/^(AWAITING|WAITING|BLOCKED|NEEDS)/.test(s)) return 'waiting';
  if (/^(IN_PROGRESS|ACTIVE|WIP|STARTED)$/.test(s)) return 'active';
  if (/^(PAUSED|DEFERRED|IDLE|ON_HOLD|NOT_STARTED)$/.test(s)) return 'paused';
  return 'unknown';
}

export function checkpointTemplate({ task = '<what this project is doing right now>', date = new Date().toISOString() } = {}) {
  return [
    'STATUS: IN_PROGRESS',
    `TASK: ${task}`,
    `DATE: ${date}`,
    'LAST_ACTION: <the last thing that was actually done>',
    'NEXT: <the next concrete step, or "await user input">',
    'BLOCKER: none',
    'DO_NOT_REDO:',
    '- <idempotent steps that are already done and must not be repeated>',
    'VERIFY_BEFORE_ACT: <commands that check the current state before deploy/migration/delete>',
    '',
  ].join('\n');
}
