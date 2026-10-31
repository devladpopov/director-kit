#!/usr/bin/env node
// SessionStart hook: puts the project's CHECKPOINT.md in front of the model before it does anything.
// stdout of a SessionStart hook is added to the session context.
import path from 'node:path';
import { readCheckpoint, statusOf } from '../lib/checkpoint.mjs';

const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const cp = readCheckpoint(dir);

if (!cp) {
  console.log('[director-kit] No CHECKPOINT.md in this project. After the first significant task, write one (skill: checkpoint-protocol).');
  process.exit(0);
}

const f = cp.fields;
const st = statusOf(f.STATUS);
const L = [`[director-kit] CHECKPOINT.md (${path.basename(dir)}), read before acting:`];
for (const k of ['STATUS', 'TASK', 'DATE', 'LAST_ACTION', 'NEXT', 'BLOCKER', 'WAIT_FOR', 'NOT_BEFORE', 'VERIFY_BEFORE_ACT']) if (f[k]) L.push(`${k}: ${f[k]}`);
if (cp.lists.DO_NOT_REDO?.length) L.push('DO_NOT_REDO:', ...cp.lists.DO_NOT_REDO.map((x) => `- ${x}`));
if (st === 'done') L.push('The task above is COMPLETED. Do not repeat it; wait for a new instruction.');
else L.push('Continue from NEXT. Before any deploy, migration or delete, run VERIFY_BEFORE_ACT; skip steps that are already done.');
console.log(L.join('\n'));
