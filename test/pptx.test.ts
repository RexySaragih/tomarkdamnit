import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pptxToMarkdown } from "../src/converters/pptx.ts";
import { parseRelationships, resolvePartPath } from "../src/shared/ooxml.ts";
import { buildPptx, textShape, type SlideSpec } from "./helpers/pptx.ts";

const workDir = mkdtempSync(join(tmpdir(), "tomark-pptx-"));
let fileCounter = 0;

afterAll(() => rmSync(workDir, { recursive: true, force: true }));

async function convert(slides: SlideSpec[], order?: number[]): Promise<string> {
  const path = join(workDir, `deck${fileCounter++}.pptx`);
  writeFileSync(path, buildPptx(slides, order));
  return pptxToMarkdown(path);
}

const THREE_SLIDES: SlideSpec[] = [
  { file: 1, shapes: textShape("Alpha") },
  { file: 2, shapes: textShape("Bravo") },
  { file: 3, shapes: textShape("Charlie") },
];

describe("pptxToMarkdown slide order", () => {
  test("follows presentation.xml order, not slide file names", async () => {
    const md = await convert(THREE_SLIDES, [2, 3, 1]);
    expect(md.indexOf("Bravo")).toBeLessThan(md.indexOf("Charlie"));
    expect(md.indexOf("Charlie")).toBeLessThan(md.indexOf("Alpha"));
    expect(md).toContain("## Slide 1\n\nBravo");
  });

  test("skips slide files not listed in presentation.xml", async () => {
    const md = await convert(THREE_SLIDES, [3, 1]);
    expect(md).not.toContain("Bravo");
  });

  test("falls back to file-name order when presentation.xml is missing", async () => {
    const md = await convert(THREE_SLIDES);
    expect(md.indexOf("Alpha")).toBeLessThan(md.indexOf("Bravo"));
    expect(md.indexOf("Bravo")).toBeLessThan(md.indexOf("Charlie"));
  });

  test("finds notes through the slide relationships", async () => {
    const md = await convert(
      [{ file: 1, shapes: textShape("Body"), notes: textShape("Say this") }],
      [1]
    );
    expect(md).toContain("### Notes\n\nSay this");
  });
});

describe("ooxml helpers", () => {
  test("parseRelationships reads attributes in any order", () => {
    const rels = parseRelationships(
      '<Relationships><Relationship Target="a.xml" Id="r1" Type="t/slide"/><Relationship Id="r2" TargetMode="External" Target="https://x" Type="t/link"/></Relationships>'
    );
    expect(rels).toEqual([
      { id: "r1", target: "a.xml", type: "t/slide", external: false },
      { id: "r2", target: "https://x", type: "t/link", external: true },
    ]);
  });

  test("resolvePartPath resolves relative and absolute targets", () => {
    const notes = /^ppt\/notesSlides\/notesSlide\d+\.xml$/;
    expect(resolvePartPath("ppt/slides", "../notesSlides/notesSlide1.xml", notes)).toBe(
      "ppt/notesSlides/notesSlide1.xml"
    );
    expect(resolvePartPath("ppt/slides", "/ppt/notesSlides/notesSlide2.xml", notes)).toBe(
      "ppt/notesSlides/notesSlide2.xml"
    );
  });

  test("resolvePartPath rejects escapes, NUL bytes, and unexpected parts", () => {
    const slide = /^ppt\/slides\/slide\d+\.xml$/;
    expect(resolvePartPath("ppt", "../../../etc/passwd", slide)).toBeUndefined();
    expect(resolvePartPath("ppt", "slides/slide1.xml\0", slide)).toBeUndefined();
    expect(resolvePartPath("ppt", "media/image1.png", slide)).toBeUndefined();
  });
});
