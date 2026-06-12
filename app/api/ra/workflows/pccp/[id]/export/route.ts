// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-018, REQ-PCCP-019)
import { withPermission } from '@/lib/auth/with-permission';
import type { AuthSession } from '@/lib/auth/with-permission';
import { db } from '@/lib/db/client';
import { pccpComponents, pccpVersions } from '@/lib/db/schema';
import { exportPccpToDocx, getDocxFilename } from '@/lib/pccp/exporters/docx';
import { exportPccpToPdf, getPdfFilename } from '@/lib/pccp/exporters/pdf';
import type { PccpComponentType, PccpVersion } from '@/lib/pccp/types';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const ExportBodySchema = z.object({
  format: z.enum(['docx', 'pdf']),
  include_draft_watermark: z.boolean().default(true),
});

async function postExport(
  request: Request,
  params: { id: string },
  _session: AuthSession,
): Promise<Response> {
  const { id } = params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid input' }, { status: 400 });
  }

  const parsed = ExportBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 },
    );
  }

  const [version] = await db.select().from(pccpVersions).where(eq(pccpVersions.id, id)).limit(1);

  if (!version) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const components = await db
    .select()
    .from(pccpComponents)
    .where(eq(pccpComponents.pccpVersionId, id));

  const versionTyped = version as unknown as PccpVersion;
  const componentsTyped = components as unknown as PccpComponentType[];
  const { format, include_draft_watermark } = parsed.data;

  if (format === 'docx') {
    const buf = await exportPccpToDocx(versionTyped, componentsTyped, {
      includeDraftWatermark: include_draft_watermark,
    });
    const filename = getDocxFilename(versionTyped);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const buf = await exportPccpToPdf(versionTyped, componentsTyped, {
    includeDraftWatermark: include_draft_watermark,
  });
  const filename = getPdfFilename(versionTyped);
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export const POST = withPermission('consult.create', async (request, ctx, session) =>
  postExport(request, (await ctx.params) as { id: string }, session),
);
