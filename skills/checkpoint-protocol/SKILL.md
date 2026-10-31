---
name: checkpoint-protocol
description: Keep CHECKPOINT.md in the project root so any new session, compaction or crash resumes exactly where work stopped and never repeats finished steps. Use after finishing a significant task, before a risky action, after context compaction or "continue where you left off", and when the user asks what state a project is in.
---

# CHECKPOINT protocol

One file, `CHECKPOINT.md` in the project root, plain `KEY: value` lines. It is the single source of truth about where the work is. The director-kit board and audit read it, and the SessionStart hook shows it to you at the start of every session.

## Format

```
STATUS: IN_PROGRESS | AWAITING_USER | COMPLETED | PAUSED
TASK: <one line: what this project is doing now>
DATE: <ISO timestamp of this update>
LAST_ACTION: <the last thing actually done, with evidence: commit, URL, file>
NEXT: <the next concrete step, or "await user input">
BLOCKER: none | you: <what the user must do> | external: <who we wait for>
DO_NOT_REDO:
- <idempotent steps already done: "migration 012 applied", "email to X sent 21.10">
VERIFY_BEFORE_ACT: <commands that check real state: git log -1, curl /health, list migrations>
```

Optional:

- `NOT_BEFORE: 2026-11-05T08:30Z`: the next step is scheduled; until then the board shows the project as paused, not stalled.
- `WAIT_FOR: <topic, person or event>`: what the work is waiting on when it is not the user.
- `PROGRESS: 40%`, `GOAL:`, `METRIC: name | target | fact`.

## Rules

1. **Read first.** At session start, after compaction, or on "continue", read CHECKPOINT.md before anything else. If `STATUS: COMPLETED`, do not redo the work: say it is done and wait for a new instruction.
2. **Verify before acting.** Before any deploy, migration, payment, message or delete, run `VERIFY_BEFORE_ACT` and compare with `DO_NOT_REDO`. If the goal is already reached, log "already done" and skip.
3. **Never duplicate a successful side effect** (sent email, posted message, charged card) without a new explicit reason.
4. **Rewrite on milestones.** After each significant step, rewrite the file: new LAST_ACTION, new NEXT, append to DO_NOT_REDO. Rewrite, do not append history: history belongs in git or an archive file.
5. **Waiting is a status.** When the next step needs the user, set `STATUS: AWAITING_USER`, `NEXT: await user input` and say exactly what is needed in `BLOCKER: you: ...`. The board puts it in "Waiting on you" (either signal is enough).
6. **No secrets.** Never write tokens, passwords or personal data into CHECKPOINT.md. Point to where they live instead.

## Creating one

`director-kit checkpoint <dir>` writes the template without overwriting an existing file. Fill TASK, LAST_ACTION and NEXT from what you actually know; leave nothing as a placeholder.
