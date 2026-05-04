// @MX:NOTE [AUTO] XLSX text extractor — uses ExcelJS to read spreadsheet cells.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-020)
import { ExtractError } from './pdf';

/**
 * Extract text content from an XLSX buffer.
 * Joins all cell values with newlines.
 * Throws ExtractError for corrupted or unreadable files.
 */
export async function extractXlsx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ExcelJS: any;
  try {
    // @ts-expect-error - exceljs is an optional runtime dependency
    ExcelJS = await import('exceljs');
  } catch {
    throw new ExtractError('exceljs package not available');
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch (err) {
    throw new ExtractError('Failed to load XLSX file', err);
  }

  const lines: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workbook.eachSheet((sheet: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sheet.eachRow((row: any) => {
      const cells: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      row.eachCell((cell: any) => {
        const val = cell.value;
        if (val !== null && val !== undefined) {
          cells.push(String(val));
        }
      });
      if (cells.length > 0) {
        lines.push(cells.join('\t'));
      }
    });
  });

  const text = lines.join('\n').trim();
  if (!text) {
    throw new ExtractError('XLSX contains no extractable text');
  }

  return text;
}
