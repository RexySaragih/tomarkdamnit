import { describe, expect, test } from "bun:test";
import { join } from "path";
import { pdfToMarkdown } from "../src/converters/pdf.ts";
import { docxToMarkdown } from "../src/converters/docx.ts";
import { xlsxToMarkdown } from "../src/converters/xlsx.ts";
import { pptxToMarkdown } from "../src/converters/pptx.ts";
import { toToolError } from "../src/shared/errors.ts";

const fixtures = join(import.meta.dir, "fixtures");

describe("converters", () => {
  test("pdfToMarkdown extracts text", async () => {
    const md = await pdfToMarkdown(join(fixtures, "sample.pdf"));
    expect(md).toContain("Hello PDF");
    expect(md.toLowerCase()).toContain("extracted plain text");
  });

  test("docxToMarkdown converts content and escapes table pipes", async () => {
    const md = await docxToMarkdown(join(fixtures, "sample.docx"));
    expect(md).toContain("Hello Doc");
    expect(md).toContain("A\\|B");
  });

  test("xlsxToMarkdown builds sheet tables", async () => {
    const md = await xlsxToMarkdown(join(fixtures, "sample.xlsx"));
    expect(md).toContain("## Sheet: Results");
    expect(md).toContain("Ada\\|Lovelace");
    expect(md).toContain("42");
  });

  test("pptxToMarkdown extracts slide text and notes", async () => {
    const md = await pptxToMarkdown(join(fixtures, "sample.pptx"));
    expect(md).toContain("Slide 1");
    expect(md).toContain("Title Slide");
    expect(md).toContain("Body line");
    expect(md).toContain("Speaker note here");
  });

  test("docxToMarkdown keeps nested tables from flattening into parent row", async () => {
    const md = await docxToMarkdown(join(fixtures, "nested-table.docx"));
    expect(md).toContain("Outer");
    expect(md).toContain("Right");
    // Inner table should appear as its own table section, not as a 3rd outer cell
    expect(md).toContain("Inner");
    expect(md).not.toMatch(/\| Outer[\s\S]*Inner[\s\S]*Right \|/);
  });
});

describe("toToolError", () => {
  test("wraps Error messages", () => {
    const result = toToolError(new Error("boom"));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("boom");
  });
});
