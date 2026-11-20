import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { join } from "path";
import { NO_TEXT_MESSAGE, pdfToMarkdown } from "../src/converters/pdf.ts";
import { redirectConsoleToStderr } from "../src/shared/stdout-guard.ts";

const fixtures = join(import.meta.dir, "fixtures");

describe("pdfToMarkdown", () => {
  test("extracts text from a valid PDF", async () => {
    const md = await pdfToMarkdown(join(fixtures, "sample.pdf"));
    expect(md).toContain("Hello PDF");
    expect(md).toContain("from 1 page(s)");
  });

  test("returns the no-text notice for a PDF without a text layer", async () => {
    const md = await pdfToMarkdown(join(fixtures, "no-text.pdf"));
    expect(md).toBe(NO_TEXT_MESSAGE);
  });
});

describe("redirectConsoleToStderr", () => {
  const original = { log: console.log, info: console.info, warn: console.warn, debug: console.debug };

  afterEach(() => {
    Object.assign(console, original);
  });

  test("routes console.log, info and warn to stderr, not stdout", () => {
    const stdout = spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      redirectConsoleToStderr();
      console.log("Warning: %s", "leak");
      console.info("info");
      console.warn("warn");
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr.mock.calls.map((c) => String(c[0]))).toEqual([
        "Warning: leak\n",
        "info\n",
        "warn\n",
      ]);
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });
});
