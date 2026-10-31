# Install, by platform

director-kit needs Node 18+ and git. Claude Code is optional: the board and the audit work without it, the plugin adds the CHECKPOINT protocol to every session.

Check what you have:

```
node --version      # v18 or newer
git --version
npx director-kit doctor
```

## Windows (PowerShell)

```powershell
winget install OpenJS.NodeJS.LTS Git.Git     # skip if you already have both
npx director-kit --root="$HOME\Projects"
```

The board opens in your default browser. It lives in `%USERPROFILE%\.director-kit\board.html`, so you can pin it as a bookmark.

## macOS

```bash
brew install node git                        # skip if you already have both
npx director-kit --root=~/Projects
```

## Linux (Ubuntu, Debian)

```bash
sudo apt install -y nodejs npm git           # Node 18+; on older releases use nodesource or nvm
npx director-kit --root=~/Projects
```

On a server without a browser add `--no-open` and copy `~/.director-kit/board.html` to your laptop, or read the audit instead: `npx director-kit audit`.

## WSL

Run it inside WSL with a WSL path (`--root=~/Projects`). Pointing it at `/mnt/c/...` works but git over the Windows mount is several times slower; the Windows install above is faster for projects on the C: drive.

## Without npx

```bash
git clone https://github.com/devladpopov/director-kit
cd director-kit
node bin/director-kit.mjs --root=~/Projects
npm link            # optional: puts `director-kit` on your PATH
```

## Claude Code plugin

```bash
claude plugin marketplace add devladpopov/director-kit
claude plugin install director-kit@director-kit
```

What you get:

- a SessionStart hook: every new session in a project with `CHECKPOINT.md` sees STATUS, NEXT, DO_NOT_REDO and VERIFY_BEFORE_ACT before your first message;
- skills `checkpoint-protocol`, `memory-floors`, `project-audit`;
- commands `/director-kit:board`, `/director-kit:audit`, `/director-kit:checkpoint`.

Check it: open Claude Code in a project that has a `CHECKPOINT.md` and ask "what does the checkpoint say?". The answer should quote your NEXT line without reading the file.

Update: `claude plugin update director-kit@director-kit`. Remove: `claude plugin uninstall director-kit@director-kit`.

## Daily audit on a schedule

The audit is saved to `~/.director-kit/audits/audit-YYYY-MM-DD.md` and the board is rebuilt on every run.

Windows (Task Scheduler, every day at 08:00):

```powershell
schtasks /Create /SC DAILY /ST 08:00 /TN director-kit-audit /TR "cmd /c npx -y director-kit audit --no-open"
```

macOS and Linux (cron; use the full path to npx, cron has a short PATH):

```bash
crontab -e
0 8 * * * /usr/local/bin/npx -y director-kit audit --no-open >/dev/null 2>&1
```

`which npx` prints the path to use.

## Several project folders

One config, one root. For a second folder, run with `--root` and `DIRECTOR_KIT_HOME` pointing to a separate home, so the boards do not overwrite each other:

```bash
DIRECTOR_KIT_HOME=~/.director-kit-work npx director-kit --root=~/work
```

## Uninstall

```bash
rm -rf ~/.director-kit                       # Windows: Remove-Item -Recurse $HOME\.director-kit
claude plugin uninstall director-kit@director-kit
```

Nothing else is written outside your projects. The kit never edits a project unless you run `director-kit checkpoint <dir>`, which only creates a missing `CHECKPOINT.md`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `0 projects` | A project is a direct subfolder of the root with `.git` or `CHECKPOINT.md`. Point `--root` at the folder that contains your repos, not at one repo inside it. |
| Everything is `dormant` | git is not on PATH (`director-kit doctor`). Without git only `CHECKPOINT.md` folders are seen. |
| The scan takes long | Git is the slow part: about 4 git calls per repo, in parallel. Huge repos or a busy CPU add seconds. Add folders you never want scanned to `"skip"` in `~/.director-kit/config.json`. |
| The browser does not open | Use `--no-open` and open `~/.director-kit/board.html` yourself. On CI the browser is never opened. |
| A screenshot for a post | `director-kit demo` (sample data) or `director-kit board --private` (no absolute paths). |
