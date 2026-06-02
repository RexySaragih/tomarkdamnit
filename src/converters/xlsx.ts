import * as XLSX from "xlsx";
import { existsSync } from "fs";

export function xlsxToMarkdown(filepath: string): string {
  if (!existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  const workbook = XLSX.readFile(filepath);
  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    // Get sheet range
    const ref = sheet["!ref"];
    if (!ref) {
      sections.push(`## ${sheetName}\n\n_Empty sheet._`);
      continue;
    }

    const rows: (string | number | boolean | null)[][] =
      XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });

    if (rows.length === 0) {
      sections.push(`## ${sheetName}\n\n_Empty sheet._`);
      continue;
    }

    // Find max columns across all rows
    const maxCols = Math.max(...rows.map((r) => r.length));

    // Pad rows to same width
    const padded = rows.map((row) => {
      const copy = [...row];
      while (copy.length < maxCols) copy.push("");
      return copy.map((cell) =>
        cell === null || cell === undefined
          ? ""
          : String(cell).replace(/\|/g, "\\|").replace(/\n/g, " ")
      );
    });

    const header = `| ${padded[0].join(" | ")} |`;
    const separator = `| ${padded[0].map(() => "---").join(" | ")} |`;
    const body = padded
      .slice(1)
      .map((r) => `| ${r.join(" | ")} |`)
      .join("\n");

    const table = `${header}\n${separator}\n${body}`;
    sections.push(`## Sheet: ${sheetName}\n\n${table}`);
  }

  return sections.join("\n\n---\n\n").trim();
}
