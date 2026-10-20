/**
 * Ops status collector — t3610 서비스 상황판 데이터 수집 사이드카.
 *
 * Runs as a plain user (cron, every 2 minutes). Gathers service liveness, repo WIP state,
 * cron freshness, and system health into var/ops-status.json. The web app
 * ONLY reads this file — the Next.js process is granted no privileges
 * (no docker socket, no shell), so a web compromise cannot escalate.
 *
 * Content policy: states, timestamps and counts only — never log bodies
 * (secrets/PII can flow through these services).
 *
 * Usage: tsx scripts/ops-status-collector.ts   (cron: every 2 minutes)
 */
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT_PATH = path.join(process.cwd(), 'var', 'ops-status.json');
const HOME = process.env.HOME ?? '/home/abyz-lab';
const REPO_ROOT = path.join(HOME, 'work', 'workspace-github', 'holee9');

function sh(cmd: string, args: string[], timeoutMs = 8000): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs }, (err, stdout) => {
      resolve(err ? '' : String(stdout).trim());
    });
  });
}

/** Any HTTP response (even 4xx/5xx) counts as "process up". */
async function httpUp(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(url, { signal: ac.signal, redirect: 'manual' });
    clearTimeout(t);
    return res.status > 0;
  } catch {
    return false;
  }
}

async function fileAgeHours(p: string): Promise<number | null> {
  try {
    const st = await fs.stat(p);
    return (Date.now() - st.mtimeMs) / 3_600_000;
  } catch {
    return null;
  }
}

const HTTP_SERVICES: Array<{ id: string; label: string; url: string }> = [
  { id: 'regula-app', label: 'Regula 앱 (:3100)', url: 'http://127.0.0.1:3100/login' },
  {
    id: 'regula-tunnel',
    label: 'Regula 터널 (regula.abyz-lab.work)',
    url: 'https://regula.abyz-lab.work/login',
  },
  { id: 'hermes-ra', label: 'hermes-ra (:8643)', url: 'http://127.0.0.1:8643/' },
  { id: 'qdrant', label: 'qdrant (:6333)', url: 'http://127.0.0.1:6333/' },
  { id: 'honcho', label: 'honcho (:8000)', url: 'http://127.0.0.1:8000/' },
  { id: 'virtual-office', label: 'virtual-office (:3001)', url: 'http://127.0.0.1:3001/' },
];

const WATCHED_CONTAINERS = [
  'regula-dev-db',
  'cloudflared-regula',
  'qdrant',
  'honcho-api-1',
  'virtual-office-virtual-office-1',
];

const WATCHED_REPOS = ['ra-med-bot', 'MD-process', 'ra-project', 'ra-hermes-multi-agent'];

const WATCHED_CRON_LOGS = [
  { label: 'hermes-ra 지식 sync (07:0x)', path: '/var/log/hermes-ra-sync.log' },
  { label: 'NAS 인덱서 (02:00)', path: '/var/log/hermes-nas-indexer.log' },
  { label: 'KB 인덱싱 (03:1x)', path: path.join(HOME, 'logs', 'hermes-kb-index.log') },
];

async function collectServices() {
  const http = await Promise.all(
    HTTP_SERVICES.map(async (s) => ({ id: s.id, label: s.label, up: await httpUp(s.url) })),
  );
  const dockerRaw = await sh('docker', ['ps', '--format', '{{.Names}}\t{{.Status}}']);
  const containers: Record<string, string> = {};
  for (const line of dockerRaw.split('\n')) {
    if (!line.trim()) continue;
    const [name, status] = line.split('\t');
    if (name && status && WATCHED_CONTAINERS.includes(name)) containers[name] = status;
  }
  return { http, containers };
}

async function collectRepos() {
  const out = [];
  for (const name of WATCHED_REPOS) {
    const dir = path.join(REPO_ROOT, name);
    const branch = await sh('git', ['-C', dir, 'branch', '--show-current']);
    if (!branch) continue; // not a repo / missing
    const dirty = await sh('git', ['-C', dir, 'status', '--porcelain']);
    const last = await sh('git', ['-C', dir, 'log', '-1', '--format=%h|%cs|%s']);
    const [hash, date, subject] = last.split('|');
    out.push({
      name,
      branch,
      dirtyFiles: dirty ? dirty.split('\n').length : 0,
      lastCommit: { hash, date, subject: (subject ?? '').slice(0, 60) },
    });
  }
  return out;
}

async function collectCron() {
  return Promise.all(
    WATCHED_CRON_LOGS.map(async (c) => ({
      label: c.label,
      lastRunHoursAgo: await fileAgeHours(c.path),
    })),
  );
}

async function collectSystem() {
  const df = await sh('df', ['-h', '--output=pcent', '/']);
  const diskPct = Number((df.split('\n')[1] ?? '').replace(/[^0-9]/g, '')) || null;
  const mem = await fs.readFile('/proc/meminfo', 'utf8');
  const total = Number(/^MemTotal:\s+(\d+)/m.exec(mem)?.[1] ?? 0);
  const avail = Number(/^MemAvailable:\s+(\d+)/m.exec(mem)?.[1] ?? 0);
  const memPct = total > 0 ? Math.round(((total - avail) / total) * 100) : null;
  const backupHours = await fileAgeHours(path.join(HOME, 'regula_dev_backup_2026-10-15.sql'));
  return {
    diskPct,
    memPct,
    uptimeHours: Math.round(os.uptime() / 3_600),
    dbBackupHoursAgo: backupHours,
    hostname: os.hostname(),
  };
}

async function main() {
  const snapshot = {
    generatedAt: new Date().toISOString(),
    services: await collectServices(),
    repos: await collectRepos(),
    cron: await collectCron(),
    system: await collectSystem(),
  };
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`[ops-collector] wrote ${OUT_PATH} at ${snapshot.generatedAt}`);
}

main().catch((err) => {
  console.error('[ops-collector] failed:', err);
  process.exit(1);
});
