#!/usr/bin/env node
// Writes Excel fixtures: dates in .xlsx (exceljs) and legacy BIFF8 .xls (SheetJS).
import { copyFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");
const JAN_15_2024 = new Date(Date.UTC(2024, 0, 15));

async function writeDatesXlsx() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Dates");
  sheet.addRow(["Event", "Date"]);
  sheet.addRow(["Launch", JAN_15_2024]);
  await workbook.xlsx.writeFile(join(FIXTURES, "dates.xlsx"));
}

function writeLegacyXls() {
  const sheet = XLSX.utils.aoa_to_sheet(
    [
      ["Name", "Score", "Date"],
      ["Ada|Lovelace", 42, JAN_15_2024],
    ],
    { cellDates: true, UTC: true }
  );
  sheet.D1 = { t: "s", v: "Total" };
  sheet.D2 = { t: "n", v: 84, f: "B2*2" };
  sheet["!ref"] = "A1:D2";
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Legacy");
  const data = XLSX.write(workbook, { type: "buffer", bookType: "biff8" });
  writeFileSync(join(FIXTURES, "legacy.xls"), data);
}

await writeDatesXlsx();
writeLegacyXls();
// A modern workbook saved with a legacy extension, detected by content.
copyFileSync(join(FIXTURES, "sample.xlsx"), join(FIXTURES, "misnamed-zip.xls"));
console.log("Wrote dates.xlsx, legacy.xls, misnamed-zip.xls");
