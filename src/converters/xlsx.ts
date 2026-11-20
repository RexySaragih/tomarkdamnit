import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import {
  OLE_MAGIC,
  XLSX_MAX_COLS,
  XLSX_MAX_ROWS,
  ZIP_MAGIC,
} from "../shared/constants.js";
import { assertReadableFile, readFileBuffer } from "../shared/fs.js";
import { hasMagic } from "../shared/magic.js";
import { rowsToMarkdownTable } from "../shared/markdown.js";

interface SheetRows {
  name: string;
  rows: string[][];
  truncated: boolean;
}

const NO_SHEETS_MESSAGE = "_No worksheets found in this workbook._";

// Both exceljs and SheetJS (with UTC: true) return dates at UTC midnight.
// Local getters would shift the day for anyone west of UTC.
export function formatDate(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function scalarToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return formatDate(value);
  return String(value);
}

function objectCellToString(value: object): string {
  if ("formula" in value || "sharedFormula" in value) {
    const formula = value as
      | ExcelJS.CellFormulaValue
      | ExcelJS.CellSharedFormulaValue;
    if (formula.result !== undefined && formula.result !== null) {
      return scalarToString(formula.result);
    }
    return "formula" in formula && formula.formula ? `=${formula.formula}` : "";
  }
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part: ExcelJS.RichText) => part.text).join("");
  }
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("error" in value) return String(value.error);
  return String(value);
}

function cellToString(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return objectCellToString(value);
  }
  return scalarToString(value);
}

function exceljsSheetToRows(sheet: ExcelJS.Worksheet): SheetRows {
  const rows: string[][] = [];
  let truncated = false;

  sheet.eachRow({ includeEmpty: false }, (row) => {
    if (rows.length >= XLSX_MAX_ROWS) {
      truncated = true;
      return;
    }
    if (row.cellCount > XLSX_MAX_COLS) truncated = true;
    const maxCol = Math.min(row.cellCount, XLSX_MAX_COLS);
    const values: string[] = [];
    for (let col = 1; col <= maxCol; col++) {
      values.push(cellToString(row.getCell(col)));
    }
    rows.push(values);
  });

  return { name: sheet.name, rows, truncated };
}

function limitRows(name: string, rawRows: unknown[][]): SheetRows {
  const truncated =
    rawRows.length > XLSX_MAX_ROWS ||
    rawRows.some((r) => r.length > XLSX_MAX_COLS);
  const rows = rawRows
    .slice(0, XLSX_MAX_ROWS)
    .map((row) => row.slice(0, XLSX_MAX_COLS).map(scalarToString));
  return { name, rows, truncated };
}

function sectionsFromRows(sheets: SheetRows[]): string {
  if (sheets.length === 0) return NO_SHEETS_MESSAGE;

  const sections = sheets.map((sheet) => {
    if (sheet.rows.length === 0) {
      return `## Sheet: ${sheet.name}\n\n_Empty sheet._`;
    }
    const notice = sheet.truncated
      ? `\n\n_Sheet truncated to ${XLSX_MAX_ROWS.toLocaleString()} rows / ${XLSX_MAX_COLS} columns._`
      : "";
    return `## Sheet: ${sheet.name}\n\n${rowsToMarkdownTable(sheet.rows)}${notice}`;
  });

  return sections.join("\n\n---\n\n").trim();
}

async function convertXlsx(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  // exceljs types predate Node's generic Buffer<ArrayBufferLike>.
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return sectionsFromRows(workbook.worksheets.map(exceljsSheetToRows));
}

function convertXls(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    UTC: true,
  });
  return sectionsFromRows(
    workbook.SheetNames.map((name) => {
      const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
        header: 1,
        defval: "",
        blankrows: false,
        UTC: true,
      });
      return limitRows(name, raw);
    })
  );
}

export async function xlsxToMarkdown(filepath: string): Promise<string> {
  const absolutePath = await assertReadableFile(filepath, {
    extensions: [".xlsx", ".xlsm", ".xls"],
  });
  const buffer = await readFileBuffer(absolutePath);

  // Detect by content: a misnamed .xlsx that is really OLE/BIFF is common.
  if (hasMagic(buffer, OLE_MAGIC)) return convertXls(buffer);
  if (hasMagic(buffer, ZIP_MAGIC)) return convertXlsx(buffer);

  throw new Error(
    "File does not look like a valid Excel workbook (expected OLE .xls or ZIP .xlsx/.xlsm)"
  );
}
