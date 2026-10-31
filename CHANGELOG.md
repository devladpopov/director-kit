# Changelog

## 0.3.0 (unreleased)

- `BLOCKER: you: ...` (or `user:`, `owner:`) puts a project in "Waiting on you", as the checkpoint-protocol skill always said.
- `NOT_BEFORE: <ISO time>` in the future shows the project as paused until then instead of stalled.
- `WAIT_FOR` and `NOT_BEFORE` appear on board cards and in the SessionStart hook.
- `director-kit version` and `--version`; `doctor` prints the version.
- Audit: the empty backups section now suggests `director-kit backup add`.
- Unit tests with `node:test` (checkpoint parser, status rules, board, audit, backups, html escaping), run in CI next to the smoke test.
- Docs: [docs/INSTALL.md](docs/INSTALL.md) per platform, [examples/](examples/), [README.ru.md](README.ru.md).

## 0.2.1 (31 Oct 2026)

- `director-kit demo` writes to `~/.director-kit/demo/` and no longer overwrites the real board.
- README: fresh numbers from a live `director-kit board`, screencast with voiceover.

## 0.2.0 (23 Oct 2026)

- Parallel scan: 28 s to 5 s on 214 repos.
- `director-kit backup add | list | rm`.
- Demo screenshot, dated claim in README.

## 0.1.0 (23 Oct 2026)

- Board, audit, CHECKPOINT SessionStart hook, memory floors, templates, `npx` installer and Claude Code plugin.
