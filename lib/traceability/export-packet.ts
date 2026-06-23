// @MX:NOTE [AUTO] export-packet — render an EvidencePacket via ExportHub.
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-008)
//
// Reuses lib/export/export-hub.ts (Markdown + PDF exporters) — do NOT reinvent
// rendering. The packet is flattened into a plain object the exporters already
// understand (title + sections), so PDF/Markdown bytes come from the shared
// pipeline used by Predicate/CER/DHF exports.

import { defaultExportHub } from '@/lib/export/export-hub';
import { ExportFormat, type ExportOptions, type ExportResult } from '@/lib/export/types';
import type { EvidencePacket } from './evidence-packet';

export type PacketFormat = 'pdf' | 'md';

/**
 * L4 fix (defense-in-depth): escape Markdown special characters in DB-sourced
 * values before interpolation. These values (refTable/refId/authority/version)
 * are written by ra-lead users or system hooks — low risk, but a regulated tool
 * must not let DB content alter document structure. Escaping `#`, `*`, `_`,
 * backticks, and brackets prevents a malicious or accidental injection from
 * changing heading levels, creating links, or breaking list structure.
 */
function escapeMd(value: string | null | undefined): string {
  if (!value) return '';
  // Strip control chars (CRLF, null) first — they must not appear in Markdown
  // content (a CRLF in a heading could alter document structure downstream).
  let s = value.replace(/[\r\n\t\0]/g, ' ');
  // Escape Markdown special characters.
  s = s.replace(/([\\`*_[\]#<>])/g, '\\$1');
  return s;
}

/**
 * L3 fix (header injection defense): sanitize a filename for use in the
 * Content-Disposition header. Strips path separators, control characters,
 * and CRLF sequences; caps length to 128 chars. The result is safe to embed
 * in `attachment; filename="<sanitized>"`.
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes.
  let s = filename.replace(/[/\\]/g, '_').replace(/\0/g, '');
  // Remove control chars and CRLF (prevent header injection).
  s = s.replace(/[\r\n\t]/g, '').replace(/[^\x20-\x7E]/g, '');
  // Remove double quotes (Content-Disposition uses quoted-string form).
  s = s.replace(/"/g, '');
  // Collapse multiple underscores.
  s = s.replace(/_+/g, '_');
  // Cap length.
  return s.slice(0, 128) || 'evidence-packet';
}

/**
 * Flatten the packet tree into a Markdown document the ExportHub's
 * MarkdownExporter / PDFExporter can consume. The exporter validates a
 * `{ content: string, citations?, html? }` shape, so we render here.
 *
 * Each upstream evidence node becomes a list item; issues are appended as a
 * final "Compliance Notes" section. The same content string feeds both the
 * Markdown and PDF renderers so output stays consistent.
 */
export function packetToMarkdown(packet: EvidencePacket): string {
  const d = packet.deliverable;
  const lines: string[] = [];
  lines.push(`# Evidence Packet — ${escapeMd(d.refTable)}:${escapeMd(d.refId)}`);
  lines.push('');
  lines.push('## Deliverable');
  lines.push(
    `${escapeMd(d.refTable)}:${escapeMd(d.refId)}${d.authority ? ` (authority: ${escapeMd(d.authority)})` : ''}${d.version ? ` v${escapeMd(d.version)}` : ''}`,
  );
  lines.push('');

  const walk = (node: typeof d, depth: number) => {
    if (node.relation !== 'root') {
      const indent = '  '.repeat(depth);
      const staleTag = node.stale ? ' [STALE]' : '';
      lines.push(
        `${indent}- **${escapeMd(node.relation)}** → ${escapeMd(node.nodeType)}: ${escapeMd(node.refTable)}:${escapeMd(node.refId)}${node.authority ? ` (${escapeMd(node.authority)})` : ''}${node.version ? ` v${escapeMd(node.version)}` : ''}${node.artifactHash ? ` \`sha256:${node.artifactHash.slice(0, 12)}\`` : ''}${staleTag}`,
      );
    }
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  };
  walk(d, 0);
  lines.push('');

  if (packet.issues.length > 0) {
    lines.push('## Compliance Notes');
    for (const issue of packet.issues) {
      lines.push(`- [${escapeMd(issue.kind)}] ${escapeMd(issue.detail)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Title used for the packet — also reused by exporters as customFilename. */
export function packetTitle(packet: EvidencePacket): string {
  return `Evidence Packet — ${packet.deliverable.refTable}:${packet.deliverable.refId}`;
}

/** L3 fix: sanitized filename for Content-Disposition header. */
export function packetFilename(packet: EvidencePacket, format: PacketFormat): string {
  return sanitizeFilename(
    `evidence-packet-${packet.deliverable.refId}.${format === 'pdf' ? 'pdf' : 'md'}`,
  );
}

/** Back-compat: callers that previously consumed the { title, sections } shape. */
export function packetToExportData(packet: EvidencePacket): {
  title: string;
  content: string;
  sections: { heading: string; body: string }[];
} {
  const d = packet.deliverable;
  const sections: { heading: string; body: string }[] = [];
  sections.push({
    heading: 'Deliverable',
    body: `${d.refTable}:${d.refId}${d.authority ? ` (authority: ${d.authority})` : ''}${d.version ? ` v${d.version}` : ''}`,
  });
  const walk = (node: typeof d, depth: number) => {
    if (node.relation !== 'root') {
      const indent = '  '.repeat(depth);
      const staleTag = node.stale ? ' [STALE]' : '';
      sections.push({
        heading: `${indent}${node.relation} → ${node.nodeType}`,
        body: `${indent}${node.refTable}:${node.refId}${node.authority ? ` (${node.authority})` : ''}${node.version ? ` v${node.version}` : ''}${node.artifactHash ? ` sha256:${node.artifactHash.slice(0, 12)}` : ''}${staleTag}`,
      });
    }
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  };
  walk(d, 0);
  if (packet.issues.length > 0) {
    sections.push({
      heading: 'Compliance Notes',
      body: packet.issues.map((i) => `- [${i.kind}] ${i.detail}`).join('\n'),
    });
  }
  return { title: packetTitle(packet), content: packetToMarkdown(packet), sections };
}

/**
 * Export the packet to PDF or Markdown bytes via ExportHub.
 * The caller (route) is responsible for the traceability.packet_exported audit.
 *
 * Both exporters validate a `{ content: string }` shape; we render the packet
 * tree to Markdown once and feed it to whichever renderer the caller picks.
 */
export async function exportPacket(
  packet: EvidencePacket,
  format: PacketFormat,
): Promise<ExportResult> {
  const exportFormat = format === 'pdf' ? ExportFormat.PDF : ExportFormat.MARKDOWN;
  const options: ExportOptions = {
    format: exportFormat,
    includeMetadata: true,
    includeTimestamp: true,
    customFilename: packetFilename(packet, format),
  };
  const data = { content: packetToMarkdown(packet) };
  return defaultExportHub.export(data, options);
}
