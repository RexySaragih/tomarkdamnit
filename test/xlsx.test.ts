import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "path";
import { formatDate, xlsxToMarkdown } from "../src/converters/xlsx.ts";

const fixtures = join(import.meta.dir, "fixtures");
const TIMEZONES = ["America/Los_Angeles", "UTC", "Asia/Jakarta", "Pacific/Kiritimati"];

describe("formatDate", () => {
  test("formats the UTC calendar day", () => {
    expect(formatDate(new Date(Date.UTC(2024, 0, 15)))).toBe("2024-01-15");
  });
});

describe("xlsxToMarkdown", () => {
  // TZ must be set before the runtime starts, so each zone runs in a child process.
  test.each(TIMEZONES)("keeps .xlsx and .xls dates correct in %s", (tz) => {
    const script = `
      const { xlsxToMarkdown } = await import(${JSON.stringify(join(import.meta.dir, "../src/converters/xlsx.ts"))});
      const xlsx = await xlsxToMarkdown(${JSON.stringify(join(fixtures, "dates.xlsx"))});
      const xls = await xlsxToMarkdown(${JSON.stringify(join(fixtures, "legacy.xls"))});
      console.log(JSON.stringify({ xlsx, xls }));
    `;
    const run = spawnSync(process.execPath, ["-e", script], {
      env: { ...process.env, TZ: tz },
      encoding: "utf8",
    });
    expect(run.stderr).toBe("");
    const { xlsx, xls } = JSON.parse(run.stdout);
    expect(xlsx).toContain("2024-01-15");
    expect(xls).toContain("2024-01-15");
  });

  test("converts legacy BIFF8 .xls with escaped pipes and formula values", async () => {
    const md = await xlsxToMarkdown(join(fixtures, "legacy.xls"));
    expect(md).toContain("## Sheet: Legacy");
    expect(md).toContain("Ada\\|Lovelace");
    expect(md).toContain("| 42 |");
    expect(md).toContain("84");
    expect(md).not.toContain("B2*2");
  });

  test("detects a ZIP workbook saved with a .xls extension by content", async () => {
    const md = await xlsxToMarkdown(join(fixtures, "misnamed-zip.xls"));
    expect(md).toContain("## Sheet: Results");
  });

  test("rejects a .xlsx file that is neither OLE nor ZIP", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tomark-xlsx-"));
    const fake = join(dir, "fake.xlsx");
    writeFileSync(fake, "%PDF-1.4 not a workbook");
    await expect(xlsxToMarkdown(fake)).rejects.toThrow(/valid Excel workbook/);
  });
});
