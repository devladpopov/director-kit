// board.json + a single self-contained board.html (no server, no CDN, opens from disk).
import fs from 'node:fs';
import path from 'node:path';

export const COLUMNS = [
  { id: 'waiting', label: 'Waiting on you' },
  { id: 'active', label: 'Active' },
  { id: 'stalled', label: 'Stalled' },
  { id: 'paused', label: 'Paused' },
  { id: 'done', label: 'Done' },
  { id: 'dormant', label: 'Dormant' },
];

export function buildBoard(scan, { privatePaths = false } = {}) {
  const unique = new Set();
  for (const p of scan.projects) for (const h of p.git?.hashes || []) unique.add(h);
  const projects = scan.projects.map((p) => {
    const { hashes, ...g } = p.git || {};
    return { ...p, git: p.git ? g : null, path: privatePaths ? undefined : p.path };
  });
  const count = (s) => projects.filter((p) => p.status === s).length;
  const summary = Object.fromEntries(COLUMNS.map((c) => [c.id, count(c.id)]));
  summary.total = projects.length;
  // Worktrees share history, count each commit once. Data without hashes (demo) falls back to the sum.
  summary.commits30d = unique.size || projects.reduce((n, p) => n + (p.git?.commits30d || 0), 0);
  summary.withCheckpoint = projects.filter((p) => p.hasCheckpoint).length;
  summary.atRisk = projects.filter((p) => p.risks.length).length;
  return {
    generatedAt: new Date().toISOString(),
    root: privatePaths ? path.basename(scan.root) : scan.root,
    summary,
    columns: COLUMNS,
    projects,
  };
}

export function writeBoard(board, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const json = path.join(outDir, 'board.json');
  const html = path.join(outDir, 'board.html');
  fs.writeFileSync(json, JSON.stringify(board, null, 2));
  fs.writeFileSync(html, renderHtml(board));
  return { json, html };
}

export function renderHtml(board) {
  const data = JSON.stringify(board).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Board: ${board.summary.total} projects</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#16181d;--mute:#6b7280;--line:#e5e7eb;--warn:#b45309;--bad:#b91c1c;--ok:#15803d;--acc:#2563eb}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#181b21;--ink:#e6e8ec;--mute:#9aa1ac;--line:#2a2f38;--warn:#f59e0b;--bad:#f87171;--ok:#4ade80;--acc:#60a5fa}}
*{box-sizing:border-box}body{margin:0;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink)}
header{padding:20px 24px 8px;display:flex;flex-wrap:wrap;gap:16px;align-items:baseline}
h1{font-size:22px;margin:0}.stat{color:var(--mute)}.stat b{color:var(--ink);font-size:18px}
.tools{padding:0 24px 12px;display:flex;gap:8px}input{flex:1;max-width:360px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)}
.cols{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(260px,1fr);gap:12px;padding:0 24px 24px;overflow-x:auto}
.col h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--mute);margin:4px 0 8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px}
.card h3{font-size:14px;margin:0 0 4px;word-break:break-word}.t{color:var(--mute);font-size:12.5px;margin:2px 0}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;font-size:12px;color:var(--mute)}
.pill{border:1px solid var(--line);border-radius:999px;padding:0 7px}.risk{color:var(--bad);border-color:currentColor}.blk{color:var(--warn)}
.bar{height:4px;background:var(--line);border-radius:2px;margin-top:6px}.bar i{display:block;height:4px;background:var(--acc);border-radius:2px}
footer{padding:0 24px 24px;color:var(--mute);font-size:12px}
</style></head><body>
<header><h1>Board</h1><span class="stat" id="stats"></span></header>
<div class="tools"><input id="q" placeholder="Filter projects" autofocus></div>
<div class="cols" id="cols"></div>
<footer id="foot"></footer>
<script id="data" type="application/json">${data}</script>
<script>
const B=JSON.parse(document.getElementById('data').textContent);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const S=B.summary;
document.getElementById('stats').innerHTML=[['projects',S.total],['commits in 30 days',S.commits30d],['waiting on you',S.waiting],['stalled',S.stalled],['at risk',S.atRisk]].map(([k,v])=>'<b>'+v+'</b> '+k).join(' &middot; ');
document.getElementById('foot').textContent='Generated '+new Date(B.generatedAt).toLocaleString()+' from '+B.root+' by director-kit. '+S.withCheckpoint+' of '+S.total+' projects keep a CHECKPOINT.md.';
function card(p){
  const g=p.git||{};const idle=p.idleDays==null?'':(p.idleDays===0?'today':p.idleDays+'d ago');
  return '<div class="card" data-q="'+esc((p.name+' '+(p.title||'')+' '+(p.task||'')+' '+(p.next||'')).toLowerCase())+'">'
   +'<h3>'+esc(p.name)+'</h3>'
   +(p.task?'<div class="t">'+esc(p.task)+'</div>':(p.title&&p.title!==p.name?'<div class="t">'+esc(p.title)+'</div>':''))
   +(p.next?'<div class="t"><b>Next:</b> '+esc(p.next)+'</div>':(p.lastAction?'<div class="t">Last: '+esc(p.lastAction)+'</div>':''))
   +(p.blocker?'<div class="t blk"><b>Blocker:</b> '+esc(p.blocker)+'</div>':'')
   +(p.waitFor?'<div class="t"><b>Waiting for:</b> '+esc(p.waitFor)+'</div>':'')
   +(p.notBefore?'<div class="t"><b>Not before:</b> '+esc(new Date(p.notBefore).toLocaleString())+'</div>':'')
   +(p.progress!=null?'<div class="bar"><i style="width:'+p.progress+'%"></i></div>':'')
   +'<div class="meta">'+(idle?'<span class="pill">'+idle+'</span>':'')+(g.commits30d?'<span class="pill">'+g.commits30d+' commits/30d</span>':'')
   +(p.hasCheckpoint?'':'<span class="pill">no checkpoint</span>')+p.risks.map(r=>'<span class="pill risk">'+esc(r)+'</span>').join('')+'</div></div>';
}
function render(q){
  q=(q||'').toLowerCase();
  document.getElementById('cols').innerHTML=B.columns.map(c=>{
    const ps=B.projects.filter(p=>p.status===c.id).sort((a,b)=>(a.idleDays??1e9)-(b.idleDays??1e9));
    if(!ps.length)return '';
    return '<section class="col"><h2>'+esc(c.label)+' ('+ps.length+')</h2>'+ps.map(card).join('')+'</section>';
  }).join('');
  if(q)document.querySelectorAll('.card').forEach(el=>{el.style.display=el.dataset.q.includes(q)?'':'none'});
}
document.getElementById('q').addEventListener('input',e=>render(e.target.value));render();
</script></body></html>
`;
}
