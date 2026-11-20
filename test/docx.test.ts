import { describe, expect, test } from "bun:test";
import { join } from "path";
import { docxToMarkdown } from "../src/converters/docx.ts";

const fixtures = join(import.meta.dir, "fixtures");

describe("docxToMarkdown images", () => {
  test("replaces images with short placeholders instead of base64 data", async () => {
    const md = await docxToMarkdown(join(fixtures, "images.docx"));
    expect(md).not.toContain("base64");
    expect(md).not.toContain("data:");
    expect(md).toContain("![Quarterly revenue \\[chart\\]]");
    expect(md).toContain("![image]");
  });

  test("keeps surrounding text in order", async () => {
    const md = await docxToMarkdown(join(fixtures, "images.docx"));
    expect(md.indexOf("Before images")).toBeLessThan(md.indexOf("![image]"));
    expect(md.indexOf("![image]")).toBeLessThan(md.indexOf("After images"));
  });
});
