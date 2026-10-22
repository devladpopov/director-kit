---
name: memory-floors
description: Keep project memory in three floors (a small index, topic files, an archive) so it stays cheap to load and nothing is lost. Use when CLAUDE.md, MEMORY.md or another memory file grows past about 6000 characters, when saving a new long-lived fact, or when the user asks to clean up, compress or reorganise memory.
---

# Memory floors

Memory that is loaded into every session must stay small, or every session pays for it and the important rules drown. Split it into floors.

| Floor | File | Loaded | Limit | Holds |
|---|---|---|---|---|
| 1. Index | `CLAUDE.md` or `MEMORY.md` | every session | 6000 chars | rules that apply to every task + a map "topic -> file" |
| 2. Topics | `memory/<topic>.md` | when the topic comes up | none, keep focused | details: accounts, decisions, how-tos, people |
| 3. Archive | `memory/archive/<YYYY-MM>.md` | only on request | none | history, superseded decisions, old logs |

## Rules

1. **Index is a map, not a diary.** One line per topic: `- deploy: memory/deploy.md (servers, order of steps, rollback)`. Rules stay in the index only if they apply to almost every task.
2. **Never delete, move.** When the index is over the limit, move the details down a floor and leave a one-line pointer. Superseded facts go to the archive with a date, not to the bin.
3. **One fact, one place.** Before adding, search the topic files; update the existing entry instead of duplicating it.
4. **Dates are absolute.** Write "2026-10-23", never "yesterday".
5. **Test before and after.** Before compressing memory, write 3 to 5 questions a session must still answer from it (e.g. "where is the deploy key?", "what is forbidden without approval?"). Answer them from the old version, compress, answer again from the new one. If any answer got worse, put the fact back into the index.
6. **No secrets in memory.** Point to where a secret lives (a password manager entry, an env file name), never paste the value.

`director-kit audit` lists every index file that is over the limit.
