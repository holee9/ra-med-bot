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
// RA intake (3-session covenant 2026-10-20): producers drop JSON metric files.
const INTAKE_DIR = '/opt/ra-intake';
// Confidential regulatory ledger — LOCAL ONLY (security covenant v1.0 [내부]):
// parsed in place, never copied into any repo. Schema: the 8-column table in
// /opt/hermes-ra/confidential/license_ledger.md.
const LEDGER_PATH = '/opt/hermes-ra/confidential/license_ledger.md';

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
    // RA 성장 대시보드 (B안) + 보안 규약 v1.0 구속 장치 (① 주기 점검·노출)
    intake: await collectIntake(),
    ledger: await collectLedger(),
    security: await collectSecurityScan(),
  };
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`[ops-collector] wrote ${OUT_PATH} at ${snapshot.generatedAt}`);
}

// RA intake files — {schemaVersion, producer, generatedAt, sections:[{kind}]}.
// Malformed files are skipped (producers are independent pipelines).
async function collectIntake(): Promise<
  Array<{ producer: string; generatedAt?: string; sections: unknown[] }>
> {
  try {
    const names = (await fs.readdir(INTAKE_DIR)).filter((n) => n.endsWith('.json'));
    const out = [];
    for (const name of names) {
      try {
        const j = JSON.parse(await fs.readFile(path.join(INTAKE_DIR, name), 'utf8')) as {
          producer?: string;
          generatedAt?: string;
          sections?: unknown[];
        };
        if (j?.producer && Array.isArray(j.sections)) {
          out.push({ producer: j.producer, generatedAt: j.generatedAt, sections: j.sections });
        }
      } catch {
        // skip malformed producer file
      }
    }
    return out;
  } catch {
    return [];
  }
}

// Confidential ledger summary — expiry countdown only, parsed locally.
// The snapshot is served admin-only; cert numbers stay out of the summary
// (row count + expiry status only) to keep even the admin view minimally
// privileged. [내부] 등급 — never leaves this machine via git.
async function collectLedger(): Promise<{
  connected: boolean;
  rows: number;
  expiringSoon: Array<{ model: string; market: string; expiresInDays: number }>;
  expired: number;
} | null> {
  try {
    const md = await fs.readFile(LEDGER_PATH, 'utf8');
    const rows = md
      .split('\n')
      .filter((l) => l.startsWith('|'))
      .slice(2) // header + separator
      .map((l) =>
        l
          .split('|')
          .slice(1, 9)
          .map((c) => c.trim()),
      );
    const today = Date.now();
    let expired = 0;
    const expiringSoon: Array<{ model: string; market: string; expiresInDays: number }> = [];
    for (const r of rows) {
      const model = r[1] ?? '';
      const market = r[2] ?? '';
      const expiry = r[7] ?? '';
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiry);
      if (!m) continue;
      const days = Math.round((new Date(`${m[1]}-${m[2]}-${m[3]}`).getTime() - today) / 86_400_000);
      if (days < 0) expired++;
      else if (days <= 90)
        expiringSoon.push({ model: model.slice(0, 30), market, expiresInDays: days });
    }
    return { connected: true, rows: rows.length, expiringSoon, expired };
  } catch {
    return null;
  }
}

// Security covenant v1.0 ① — periodic confidential-pattern scan of THIS repo's
// git-tracked files. Surfaces findings in the ops console (admin-only).
async function collectSecurityScan(): Promise<{
  findings: number;
  samples: string[];
}> {
  const tracked = await sh('git', ['-C', process.cwd(), 'ls-files']);
  if (!tracked) return { findings: 0, samples: [] };
  // Patterns: real 510(k)/cert numbers (K######), Korean 사업자번호, non-example emails.
  const patterns: Array<[RegExp, string]> = [
    [/\bK\d{6}\b/, 'K번호'],
    [/\b\d{3}-\d{2}-\d{5}\b/, '사업자번호'],
    [/[A-Za-z0-9._%+-]+@(?!example\.|test\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, '이메일'],
  ];
  const samples: string[] = [];
  let findings = 0;
  for (const f of tracked.split('\n').slice(0, 3000)) {
    // Skip vendored/harness trees (tool docs carry public author emails — not
    // [내부] data) and archive fixtures.
    if (!f || f.startsWith('.') || f.includes('node_modules') || f.startsWith('archive/')) continue;
    if (!/\.(md|ts|tsx|json|txt|csv|yml|yaml)$/.test(f)) continue;
    let content: string;
    try {
      content = await fs.readFile(f, 'utf8');
    } catch {
      continue;
    }
    for (const [re, label] of patterns) {
      if (re.test(content)) {
        findings++;
        if (samples.length < 5) samples.push(`${label}: ${f}`);
        break;
      }
    }
  }
  return { findings, samples };
}

main().catch((err) => {
  console.error('[ops-collector] failed:', err);
  process.exit(1);
});
