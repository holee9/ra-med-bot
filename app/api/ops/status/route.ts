// @MX:NOTE [AUTO] Ops status API — t3610 서비스 상황판 (2026-10-20).
// @MX:REASON Admin-only endpoint serving the sidecar-collected snapshot from
//           var/ops-status.json. The web process reads a file only — the
//           collector (cron) holds the privileges, not the app.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SNAPSHOT_PATH = path.join(process.cwd(), 'var', 'ops-status.json');
const MAX_AGE_MS = 10 * 60 * 1000; // snapshot older than 10min → stale flag

export async function GET(_req: NextRequest): Promise<NextResponse> {
  // Role gate mirrors app/admin/*/page.tsx: session role must be admin.
  try {
    const { auth } = await import('@/lib/kernel/auth');
    const session = await auth();
    if ((session?.user as { role?: string } | undefined)?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await fs.readFile(SNAPSHOT_PATH, 'utf8');
    const snapshot = JSON.parse(raw) as { generatedAt?: string };
    const age = snapshot.generatedAt
      ? Date.now() - new Date(snapshot.generatedAt).getTime()
      : Number.POSITIVE_INFINITY;
    return NextResponse.json({ stale: age > MAX_AGE_MS, ...snapshot });
  } catch {
    return NextResponse.json({ error: 'snapshot_unavailable', stale: true }, { status: 503 });
  }
}
