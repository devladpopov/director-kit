# Examples

| File | What it shows | Board column |
|---|---|---|
| [checkpoints/active.md](checkpoints/active.md) | work in progress, with DO_NOT_REDO and a health check | Active |
| [checkpoints/waiting-on-you.md](checkpoints/waiting-on-you.md) | the agent stopped and needs a decision: `BLOCKER: you: ...` | Waiting on you |
| [checkpoints/scheduled.md](checkpoints/scheduled.md) | next step is at a time: `NOT_BEFORE` | Paused until then, never "stalled" |
| [checkpoints/waiting-for-someone.md](checkpoints/waiting-for-someone.md) | waiting on a third party: `WAIT_FOR`, `BLOCKER: external:` | Active, then Stalled after 7 silent days |
| [checkpoints/done.md](checkpoints/done.md) | closed task: the next session must not redo it | Done |
| [config.json](config.json) | `~/.director-kit/config.json` with skip list and three watched backups | |
| [CLAUDE.md](CLAUDE.md) | rules that make Claude Code follow the protocol without the plugin | |

Try them: copy a file to `<project>/CHECKPOINT.md`, run `director-kit board`.
