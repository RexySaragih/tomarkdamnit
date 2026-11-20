import ExcelJS from "exceljs";
import * as XLS from "xlsjs";
import {
  OLE_MAGIC,
  XLSX_MAX_COLS,
  XLSX_MAX_ROWS,
  ZIP_MAGIC,
} from "../shared/constants.js";
import { assertReadableFile, readFileBuffer } from "../shared/fs.js";
import { rowsToMarkdownTable } from "../shared/markdown.js";

function startsWithMagic(buffer: Buffer, magic: Buffer): boolean {
  return (
    buffer.length >= magic.length &&
    buffer.subarray(0, magic.length).equals(magic)
  );
}

function formatDate(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function cellToString(cell: ExcelJS.Cell): string {
  const value = cell.value;

  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    return formatDate(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) {
      const formula = value as
        | ExcelJS.CellFormulaValue
        | ExcelJS.CellSharedFormulaValue;
      if (
        "result" in formula &&
        formula.result !== undefined &&
        formula.result !== null
      ) {
        if (formula.result instanceof Date) {
          return formatDate(formula.result);
        }
        return String(formula.result);
      }
      if ("formula" in formula && formula.formula) {
        return `=${formula.formula}`;
      }
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }

    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("error" in value) {
      return String(value.error);
    }
  }

  return String(value);
}

function sheetToRows(sheet: ExcelJS.Worksheet): {
  rows: string[][];
  truncated: boolean;
} {
  const rows: string[][] = [];
  let truncated = false;
  let rowCount = 0;

  sheet.eachRow({ includeEmpty: false }, (row) => {
    rowCount += 1;
    if (rowCount > XLSX_MAX_ROWS) {
      truncated = true;
      return;
    }

    const values: string[] = [];
    const maxCol = Math.min(row.cellCount, XLSX_MAX_COLS);
    if (row.cellCount > XLSX_MAX_COLS) truncated = true;

    for (let col = 1; col <= maxCol; col++) {
      values.push(cellToString(row.getCell(col)));
    }
    rows.push(values);
  });

  return { rows, truncated };
}

function limitRows(rawRows: unknown[][]): {
  rows: string[][];
  truncated: boolean;
} {
  const truncated =
    rawRows.length > XLSX_MAX_ROWS ||
    rawRows.some((r) => r.length > XLSX_MAX_COLS);

  const rows = rawRows.slice(0, XLSX_MAX_ROWS).map((row) =>
    row.slice(0, XLSX_MAX_COLS).map((cell) => {
      if (cell === null || cell === undefined) return "";
      if (cell instanceof Date) return formatDate(cell);
      return String(cell);
    })
  );

  return { rows, truncated };
}

function sectionsFromRows(
  sheets: Array<{ name: string; rows: string[][]; truncated: boolean }>
): string {
  const sections: string[] = [];

  for (const sheet of sheets) {
    if (sheet.rows.length === 0) {
      sections.push(`## Sheet: ${sheet.name}\n\n_Empty sheet._`);
      continue;
    }

    const table = rowsToMarkdownTable(sheet.rows);
    const notice = sheet.truncated
      ? `\n\n_Sheet truncated to ${XLSX_MAX_ROWS.toLocaleString()} rows / ${XLSX_MAX_COLS} columns._`
      : "";
    sections.push(`## Sheet: ${sheet.name}\n\n${table}${notice}`);
  }

  return sections.join("\n\n---\n\n").trim();
}

async function convertXlsx(absolutePath: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(absolutePath);

  if (workbook.worksheets.length === 0) {
    return "_No worksheets found in this workbook._";
  }

  return sectionsFromRows(
    workbook.worksheets.map((sheet) => {
      const { rows, truncated } = sheetToRows(sheet);
      return { name: sheet.name, rows, truncated };
    })
  );
}

async function convertXls(absolutePath: string): Promise<string> {
  const workbook = XLS.readFile(absolutePath, { cellDates: true });
  if (workbook.SheetNames.length === 0) {
    return "_No worksheets found in this workbook._";
  }

  return sectionsFromRows(
    workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const raw = XLS.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });
      const { rows, truncated } = limitRows(raw);
      return { name, rows, truncated };
    })
  );
}

export async function xlsxToMarkdown(filepath: string): Promise<string> {
  const absolutePath = await assertReadableFile(filepath, {
    extensions: [".xlsx", ".xlsm", ".xls"],
  });

  const buffer = await readFileBuffer(absolutePath);

  // Detect by content: misnamed .xlsx that is still OLE/BIFF is common.
  if (startsWithMagic(buffer, OLE_MAGIC)) {
    return convertXls(absolutePath);
  }
  if (startsWithMagic(buffer, ZIP_MAGIC)) {
    return convertXlsx(absolutePath);
  }

  throw new Error(
    "File does not look like a valid Excel workbook (expected OLE .xls or ZIP .xlsx/.xlsm)"
  );
}
