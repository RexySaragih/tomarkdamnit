import { describe, expect, test } from "bun:test";
import {
  rowsToMarkdownTable,
  truncateMarkdown,
} from "../src/shared/markdown.ts";
import { getMaxOutputChars } from "../src/shared/constants.ts";

describe("rowsToMarkdownTable", () => {
  test("builds a table and escapes pipes", () => {
    const md = rowsToMarkdownTable([
      ["Name", "Note"],
      ["Ada|Lovelace", "ok"],
    ]);
    expect(md).toContain("| Name | Note |");
    expect(md).toContain("| Ada\\|Lovelace | ok |");
    expect(md).toContain("| --- | --- |");
  });

  test("returns empty string for empty rows", () => {
    expect(rowsToMarkdownTable([])).toBe("");
  });

  test("drops trailing blank columns", () => {
    const md = rowsToMarkdownTable([
      ["A", "B", ""],
      ["1", "2", ""],
    ]);
    expect(md).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |");
  });
});

describe("truncateMarkdown", () => {
  test("leaves short content alone", () => {
    expect(truncateMarkdown("hello")).toBe("hello");
  });

  test("truncates long content", () => {
    const max = getMaxOutputChars();
    const long = "x".repeat(max + 10);
    const out = truncateMarkdown(long);
    expect(out.length).toBeLessThanOrEqual(max);
    expect(out).toContain("Output truncated");
  });
});
