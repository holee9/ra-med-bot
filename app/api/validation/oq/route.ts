// @MX:NOTE [AUTO] POST /api/validation/oq — OQ evidence aggregator (CI run results).
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M2, REQ-VAL-004, AC-3, Issue #49)
// @MX:REASON Thin glue: Zod input → spawn collect-oq.ts → return JSON.
//   RBAC: validation.run (admin/qa-lead). Evidence collection mutates regulated
//   state — distinct from validation.read (transparency only).

import { spawn } from 'node:child_process';
import { withPermission } from '@/lib/auth/with-permission';
import { z } from 'zod';

const oqRequestSchema = z.object({
  releaseId: z
    .string()
    .min(1)
    .max(128)
    .regex(
      /^v\d+\.\d+\.\d+(-rc\d+)?$/,
      'Invalid release_id format. Expected ^v\\d+\\.\\d+\\.\\d+(-rc\\d+)?$',
    ),
});

async function runCollectOq(releaseId: string): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      ['--experimental-strip-types', 'scripts/validation/collect-oq.ts', releaseId],
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

/* audit-check-ignore: OQ evidence rows ARE the regulated record (21 CFR Part 11 §11.10(i)).
   RBAC denial audit written by withPermission. No route-level writeAudit needed. */
export const POST = withPermission('validation.run', async (req, _ctx, _session) => {
  const body = await req.json().catch(() => null);
  const parsed = oqRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { stdout, exitCode } = await runCollectOq(parsed.data.releaseId);
    if (exitCode !== 0) {
      return Response.json(
        { error: 'OQ bundle collection failed', releaseId: parsed.data.releaseId },
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
