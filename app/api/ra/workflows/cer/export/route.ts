import { withPermission } from '@/lib/auth/with-permission';
import type { AuthSession } from '@/lib/auth/with-permission';
import { auditCerExported } from '@/lib/cer/audit';
import { assembleCer } from '@/lib/cer/cer-assembler';
import { exportToDOCX } from '@/lib/cer/exporters/docx';
import { exportToPDF } from '@/lib/cer/exporters/pdf';
import type { CerStageId } from '@/lib/cer/meddev-stages';
import { CerExportSchema } from '@/lib/workflows/types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';

// Valid MEDDEV stage ids are 1-10; ignore any out-of-range keys from input.
function toStageId(key: string): CerStageId | null {
  const n = Number.parseInt(key, 10);
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    return null;
  }
  return n as CerStageId;
}

async function postCerExport(request: Request, session: AuthSession): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid input', details: {} }, { status: 400 });
  }

  const result = CerExportSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: 'Invalid input', details: result.error.format() },
      { status: 400 },
    );
  }

  const data = result.data;

  // Reconstruct a minimal CerDocument from the supplied stage content.
  const stageContent = new Map<CerStageId, string>();
  for (const [key, value] of Object.entries(data.stageContent ?? {})) {
    const stageId = toStageId(key);
    if (stageId !== null) {
      stageContent.set(stageId, value);
    }
  }

  const cer = assembleCer({
    cerRunId: data.cerRunId,
    deviceName: data.deviceName,
    manufacturer: data.manufacturer,
    stageContent,
    literature: [],
  });

  const isPdf = data.format === 'pdf';
  const buffer = isPdf ? await exportToPDF(cer) : await exportToDOCX(cer);

  // REQ-CER-039: audit the export after the document is successfully generated.
  await auditCerExported(session.user.id, data.cerRunId, data.format);

  const safeDevice = data.deviceName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `CER_${safeDevice}_${data.cerRunId}.${data.format}`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': isPdf ? PDF_MIME : DOCX_MIME,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}

export const POST = withPermission('consult.create', async (request, _ctx, session) =>
  postCerExport(request, session),
);
