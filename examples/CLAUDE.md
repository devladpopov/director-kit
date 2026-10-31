# Project rules (example: put this in a project's CLAUDE.md, or in ~/.claude/CLAUDE.md for all projects)

## Session start
- Read CHECKPOINT.md before anything else. If STATUS is COMPLETED, say "already done, waiting for a new task" and stop.
- Before any deploy, migration, payment, message or delete: run VERIFY_BEFORE_ACT and compare with DO_NOT_REDO. Already done means skip and say so.

## While working
- After every significant step rewrite CHECKPOINT.md: LAST_ACTION, NEXT, append to DO_NOT_REDO.
- Next step needs me: STATUS: AWAITING_USER, NEXT: await user input, BLOCKER: you: <exactly what I must do>.
- Next step is at a time: NOT_BEFORE: <ISO time>. Waiting on someone else: WAIT_FOR: <who or what>.

## Needs my explicit yes
- money, deleting anything, publishing in my name, emails to clients

## Memory
- Index MEMORY.md under 6000 characters: rules and a map to memory/<topic>.md. Never delete, move to memory/archive/.
