// @MX:NOTE [AUTO] POST /api/validation/report/export — build Release Validation Report Markdown.
// @MX:SPEC SPEC-REGULA-VALIDATION-001 (M5, REQ-VAL-010, REQ-VAL-014, Issue #49)
// @MX:REASON Thin glue: Zod input → spawn build-report.ts → return file path.
//   RBAC: validation.read (admin/qa-lead/ra-lead). The generated Markdown file IS
//   the regulated report artifact (21 CFR Part 11 §11.10(i)). No separate
//   writeAudit call needed — report generation is a read-side assembly, and RBAC
//   denial audit is written by withPermission on permission_deny.

import { spawn } from 'node:child_process';
import { withPermission } from '@/lib/auth/with-permission';
import { z } from 'zod';

const exportRequestSchema = z.object({
  releaseId: z.string().min(1).max(128),
});

async function runBuildReport(releaseId: string): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      ['--experimental-strip-types', 'scripts/validation/build-report.ts', releaseId],
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

/* audit-check-ignore: report export is a read-side assembly over validation_evidence
   and change_control rows (which are themselves the regulated records). RBAC denial
   audit is written by withPermission on permission_deny. No route-level writeAudit
   needed for report generation itself. */
export const POST = withPermission('validation.read', async (req, _ctx, _session) => {
  const body = await req.json().catch(() => null);
  const parsed = exportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request body', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { stdout, exitCode } = await runBuildReport(parsed.data.releaseId);
    if (exitCode !== 0) {
      return Response.json(
        { error: 'Report build failed', releaseId: parsed.data.releaseId },
        { status: 500 },
      );
    }
    const reportArtifactPath = stdout.trim();
    return Response.json(
      {
        releaseId: parsed.data.releaseId,
        reportArtifactPath,
        format: 'markdown',
      },
      { status: 200 },
    );
  } catch (err) {
    return Response.json(
      {
        error: 'Report builder invocation error',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
});
