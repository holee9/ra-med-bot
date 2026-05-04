// @MX:NOTE [AUTO] XLSX text extractor — uses ExcelJS to read spreadsheet cells.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-020)
import { ExtractError } from './pdf';

type ExcelModule = {
  Workbook: new () => WorkbookLike;
};

type WorkbookLike = {
  xlsx: {
    load(buffer: Buffer): Promise<void>;
  };
  eachSheet(callback: (sheet: WorksheetLike) => void): void;
};

type WorksheetLike = {
  eachRow(callback: (row: RowLike) => void): void;
};

type RowLike = {
  eachCell(callback: (cell: { value: unknown }) => void): void;
};

/**
 * Extract text content from an XLSX buffer.
 * Joins all cell values with newlines.
 * Throws ExtractError for corrupted or unreadable files.
 */
export async function extractXlsx(buffer: Buffer): Promise<string> {
  let ExcelJS: ExcelModule;
  try {
    // @ts-expect-error - exceljs is an optional runtime dependency
    ExcelJS = (await import('exceljs')) as ExcelModule;
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
  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell((cell) => {
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
