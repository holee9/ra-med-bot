// @MX:NOTE [AUTO] POST /api/validation/iq — IQ evidence bundle collector.
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M1, REQ-VAL-003, Issue #49)
// @MX:REASON Thin glue: Zod input validation → spawn collect-iq.ts → return JSON.
//   RBAC: validation.run (admin/qa-lead). Evidence collection mutates regulated
//   state (validation_evidence rows) — distinct from validation.read which only
//   governs transparency. writeAudit is handled by withPermission on
//   permission_deny; evidence rows themselves are the record.

import { spawn } from 'node:child_process';
import { withPermission } from '@/lib/auth/with-permission';
import { z } from 'zod';

const iqRequestSchema = z.object({
  releaseId: z
    .string()
    .min(1)
    .max(128)
    .regex(
      /^v\d+\.\d+\.\d+(-rc\d+)?$/,
      'Invalid release_id format. Expected ^v\\d+\\.\\d+\\.\\d+(-rc\\d+)?$',
    ),
});

// audit-check-ignore rationale: this route inserts validation_evidence rows;
// those evidence records ARE the regulated audit trail (21 CFR Part 11 §11.10(i)).
// RBAC denial audit is written by withPermission on permission_deny. No separate
// writeAudit call needed for evidence collection itself.

async function runCollectIq(releaseId: string): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      ['--experimental-strip-types', 'scripts/validation/collect-iq.ts', releaseId],
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

/* audit-check-ignore: evidence rows ARE the regulated record (21 CFR Part 11 §11.10(i)).
   RBAC denial audit written by withPermission. No route-level writeAudit needed. */
export const POST = withPermission('validation.run', async (req, _ctx, _session) => {
  const body = await req.json().catch(() => null);
  const parsed = iqRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { stdout, exitCode } = await runCollectIq(parsed.data.releaseId);
    if (exitCode !== 0) {
      return Response.json(
        { error: 'IQ bundle collection failed', releaseId: parsed.data.releaseId },
        { status: 500 },
      );
    }
    // Forward the collector's JSON summary as the response body.
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
