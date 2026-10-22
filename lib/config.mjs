import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const HOME = process.env.DIRECTOR_KIT_HOME || path.join(os.homedir(), '.director-kit');
const CONFIG = path.join(HOME, 'config.json');

export const DEFAULTS = {
  root: null,
  activeDays: 7, // no commits / checkpoint edits for longer than this: stalled
  dormantDays: 30, // longer than this without a checkpoint: dormant
  memoryIndexLimit: 6000, // chars, the "index floor" of the memory floors
  backups: [], // [{ name, path, maxAgeHours }]
  skip: ['node_modules', '.git', '.cache', '.tmp', 'tmp'],
};

export function loadConfig() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG, 'utf8').replace(/^﻿/, '')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(cfg) {
  fs.mkdirSync(HOME, { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n');
  return CONFIG;
}

// First existing folder that looks like a projects root.
export function guessRoot(cwd = process.cwd()) {
  const h = os.homedir();
  const candidates = ['Projects', 'projects', 'code', 'Code', 'dev', 'src', 'repos', 'work', 'Documents/GitHub', 'GitHub']
    .map((d) => path.join(h, d));
  for (const c of candidates) if (isDir(c) && subdirs(c).length) return c;
  return cwd;
}

export const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
export const subdirs = (p) => { try { return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; } };
export { CONFIG as CONFIG_PATH };
