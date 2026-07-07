// @MX:NOTE [AUTO] POST /api/validation/pq — PQ evidence bundle (E2E + eval).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M3, REQ-VAL-005, AC-4, Issue #49)
// @MX:REASON Thin glue: Zod input → spawn collect-pq.ts → return JSON.
//   RBAC: validation.run (admin/qa-lead). Evidence collection mutates regulated
//   state — distinct from validation.read (transparency only).

import { spawn } from 'node:child_process';
import { withPermission } from '@/lib/auth/with-permission';
import { z } from 'zod';

const pqRequestSchema = z.object({
  releaseId: z.string().min(1).max(128),
});

async function runCollectPq(releaseId: string): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      ['--experimental-strip-types', 'scripts/validation/collect-pq.ts', releaseId],
      { cwd: process.cwd(), env: process.env },
    );
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ stdout, exitCode: exitCode ?? 1 }));
  });
}

/* audit-check-ignore: PQ evidence rows ARE the regulated record (21 CFR Part 11 §11.10(i)).
   RBAC denial audit written by withPermission. No route-level writeAudit needed. */
export const POST = withPermission('validation.run', async (req, _ctx, _session) => {
  const body = await req.json().catch(() => null);
  const parsed = pqRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { stdout, exitCode } = await runCollectPq(parsed.data.releaseId);
    if (exitCode !== 0) {
      return Response.json(
        { error: 'PQ bundle collection failed', releaseId: parsed.data.releaseId },
        { status: 500 },
      );
    }
    const summary = JSON.parse(stdout);
    return Response.json(summary, { status: 200 });
  } catch (err) {
    return Response.json(
      {
        error: 'Collector invocation error',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
});
