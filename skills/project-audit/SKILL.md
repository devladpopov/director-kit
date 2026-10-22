---
name: project-audit
description: Audit all projects at once (what waits on the user, what stalled, what is not backed up, which memory outgrew its floor) and turn it into a short action list. Use when the user asks "what is going on across my projects", "what is stuck", "what do I need to do", for a weekly review, or to refresh the director-kit board.
---

# Project audit

Run the audit (it also rebuilds the board):

```
node "${CLAUDE_PLUGIN_ROOT}/bin/director-kit.mjs" audit --no-open
```

If `CLAUDE_PLUGIN_ROOT` is not set, use `npx -y director-kit audit --no-open`. If it says there is no projects folder yet, ask the user for it and run `... --root=<folder>` once.

Then report to the user, shortest useful form:

1. **Waiting on you**: one line each, the concrete action (from BLOCKER or NEXT). These come first, they are the only items nobody else can move.
2. **Stalled**: the 3 to 5 longest-silent projects that are not finished, with the last NEXT. Ask whether to resume, pause (`STATUS: PAUSED`) or close (`STATUS: COMPLETED`) each one.
3. **Not safe**: repos without a remote, unpushed commits, old uncommitted work. Offer the exact command (`git push`, create remote), do not run it without a yes.
4. **Memory over the floor** and **stale backups**, if any.

Do not change other projects' files during an audit. Changing a project's CHECKPOINT.md status is fine only when the user decided it.

The board is at `~/.director-kit/board.html`; the full report is saved to `~/.director-kit/audits/`.
