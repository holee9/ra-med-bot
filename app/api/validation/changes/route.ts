// @MX:NOTE [AUTO] POST /api/validation/changes — 7-axis change-control impact assessment.
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M4, REQ-VAL-007/008/009, AC-5, Issue #49)
// @MX:REASON Thin glue: Zod input → spawn classify-changes.ts → return JSON.
//   RBAC: validation.run (admin/qa-lead). Change-control assessment mutates
//   regulated state (change_control rows) — distinct from validation.read.

import { spawn } from 'node:child_process';
import { withPermission } from '@/lib/auth/with-permission';
import { z } from 'zod';

const changesRequestSchema = z.object({
  releaseId: z.string().min(1).max(128),
  previousRef: z.string().max(256).optional(),
});

async function runClassifyChanges(
  releaseId: string,
  previousRef?: string,
): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const args = [
      '--experimental-strip-types',
      'scripts/validation/classify-changes.ts',
      releaseId,
    ];
    if (previousRef) args.push(previousRef);
    const child = spawn('node', args, { cwd: process.cwd(), env: process.env });
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (exitCode) => resolve({ stdout, exitCode: exitCode ?? 1 }));
  });
}

/* audit-check-ignore: change_control rows ARE the regulated record (21 CFR Part 11
   §11.10(i) + ISO 13485 §4.1.6). RBAC denial audit written by withPermission. */
export const POST = withPermission('validation.run', async (req, _ctx, _session) => {
  const body = await req.json().catch(() => null);
  const parsed = changesRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { stdout, exitCode } = await runClassifyChanges(
      parsed.data.releaseId,
      parsed.data.previousRef,
    );
    if (exitCode !== 0) {
      return Response.json(
        { error: 'Change-control classification failed', releaseId: parsed.data.releaseId },
        { status: 500 },
      );
    }
    const summary = JSON.parse(stdout);
    return Response.json(summary, { status: 200 });
  } catch (err) {
    return Response.json(
      {
        error: 'Classifier invocation error',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
});
