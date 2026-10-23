// Sample data for screenshots and the screencast: no real names, paths or people.
const DAY = 864e5;
const SAMPLE = [
  ['landing-page', 'waiting', 0, 14, 'Publish the pricing page', 'Approve the copy for the hero block', 'you: approve copy'],
  ['invoice-bot', 'active', 0, 31, 'Telegram bot that drafts invoices', 'Add VAT field to the PDF', null],
  ['podcast-clips', 'active', 1, 22, 'Cut 5 clips per episode automatically', 'Tune the silence threshold', null],
  ['crm-lite', 'active', 2, 18, 'Own CRM instead of a SaaS seat', 'Import contacts from CSV', null],
  ['newsletter', 'waiting', 1, 3, 'Weekly newsletter #12', 'Pick the cover image', 'you: choose image'],
  ['tax-2026', 'stalled', 9, 0, 'Self-assessment return', 'Download bank statements', null],
  ['course-ai-basics', 'stalled', 12, 2, 'Module 3: agents', 'Record lesson 3.2', null],
  ['scraper-jobs', 'active', 0, 40, 'Daily job board digest', 'Deduplicate by company', null],
  ['home-server', 'done', 3, 5, 'Backups to object storage', null, null],
  ['portfolio-site', 'done', 6, 9, 'Move to static hosting', null, null],
  ['family-photos', 'paused', 20, 0, 'Sort 2019 archive', 'Resume after holidays', null],
  ['old-game-jam', 'dormant', 140, 0, null, null, null],
  ['dotfiles', 'dormant', 61, 0, null, null, null],
];

export function demoScan(now = Date.now()) {
  const projects = SAMPLE.map(([name, status, idle, commits, task, next, blocker], i) => ({
    name,
    title: null,
    path: `~/Projects/${name}`,
    status,
    hasCheckpoint: !!task,
    task,
    next,
    lastAction: task ? 'see CHECKPOINT.md' : 'initial commit',
    blocker,
    progress: status === 'done' ? 100 : task ? (i * 17) % 90 + 5 : null,
    lastActivity: new Date(now - idle * DAY).toISOString(),
    idleDays: idle,
    git: { branch: 'main', commits30d: commits, dirtyFiles: 0, hasRemote: name !== 'tax-2026', unpushed: name === 'crm-lite' ? 3 : 0 },
    risks: name === 'tax-2026' ? ['no remote: not backed up'] : name === 'crm-lite' ? ['3 unpushed commits'] : [],
  }));
  return { root: '~/Projects (demo)', folders: projects.length, projects };
}
