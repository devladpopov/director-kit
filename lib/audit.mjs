// Audit: one markdown report over all projects. What needs you, what is stuck,
// what is not backed up, which memory indexes outgrew their floor.
import fs from 'node:fs';
import path from 'node:path';

const INDEX_FILES = ['CLAUDE.md', 'MEMORY.md', 'AGENTS.md'];

export function memoryFindings(projects, limit) {
  const out = [];
  for (const p of projects) {
    if (!p.path) continue;
    for (const f of INDEX_FILES) {
      try {
        const n = fs.readFileSync(path.join(p.path, f), 'utf8').length;
        if (n > limit) out.push({ project: p.name, file: f, chars: n });
      } catch {}
    }
  }
  return out;
}

// Newest file under a folder, depth-limited so a huge backup tree stays cheap.
export function newestFile(dir, depth = 3) {
  let best = null;
  const walk = (d, left) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (left > 0) walk(p, left - 1); continue; }
      try { const m = fs.statSync(p).mtimeMs; if (!best || m > best.mtime) best = { path: p, mtime: m }; } catch {}
    }
  };
  try { if (fs.statSync(dir).isFile()) return { path: dir, mtime: fs.statSync(dir).mtimeMs }; } catch { return null; }
  walk(dir, depth);
  return best;
}

export function backupFindings(backups, now = Date.now()) {
  return (backups || []).map((b) => {
    const f = newestFile(b.path);
    const ageH = f ? (now - f.mtime) / 36e5 : null;
    const max = b.maxAgeHours || 26;
    return { name: b.name || b.path, path: b.path, ageHours: ageH == null ? null : Math.round(ageH), maxAgeHours: max, ok: ageH != null && ageH <= max };
  });
}

export function renderAudit(board, cfg, now = Date.now()) {
  const P = board.projects;
  const S = board.summary;
  const L = [];
  const line = (p, extra) => `- **${p.name}**${extra ? `: ${extra}` : ''}`;
  L.push(`# Audit ${new Date(now).toISOString().slice(0, 16).replace('T', ' ')} UTC`, '');
  L.push(`${S.total} projects, ${S.commits30d} commits in 30 days. Waiting on you ${S.waiting}, active ${S.active}, stalled ${S.stalled}, done ${S.done}, dormant ${S.dormant}.`, '');

  const sect = (title, items) => { if (items.length) L.push(`## ${title} (${items.length})`, ...items, ''); };
  sect('Waiting on you', P.filter((p) => p.status === 'waiting').map((p) => line(p, p.blocker || p.next || p.task)));
  sect('Stalled', P.filter((p) => p.status === 'stalled').sort((a, b) => b.idleDays - a.idleDays)
    .map((p) => line(p, `silent ${p.idleDays}d. ${p.next ? 'Next was: ' + p.next : p.task || ''}`.trim())));
  sect('Not safe (no remote, unpushed or uncommitted work)', P.filter((p) => p.risks.length && p.status !== 'dormant').map((p) => line(p, p.risks.join(', '))));
  sect('Active without a CHECKPOINT.md', P.filter((p) => !p.hasCheckpoint && ['active', 'stalled'].includes(p.status)).map((p) => line(p, `run: director-kit checkpoint "${p.path || p.name}"`)));

  const mem = memoryFindings(P, cfg.memoryIndexLimit);
  sect(`Memory indexes over ${cfg.memoryIndexLimit} chars (move details to topic files)`, mem.map((m) => `- **${m.project}/${m.file}**: ${m.chars} chars`));

  const bk = backupFindings(cfg.backups, now);
  sect('Backups', bk.map((b) => `- ${b.ok ? 'OK' : 'STALE'} **${b.name}**: ${b.ageHours == null ? 'nothing found at ' + b.path : `newest file ${b.ageHours}h old`} (limit ${b.maxAgeHours}h)`));
  if (!bk.length) L.push('## Backups', '- not configured: add folders to "backups" in ~/.director-kit/config.json, see README', '');

  return { markdown: L.join('\n'), memory: mem, backups: bk };
}
