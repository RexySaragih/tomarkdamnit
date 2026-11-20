import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pptxToMarkdown } from "../src/converters/pptx.ts";
import { parseRelationships, resolvePartPath } from "../src/shared/ooxml.ts";
import { buildPptx, tableShape, textShape, type SlideSpec } from "./helpers/pptx.ts";

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

describe("pptxToMarkdown slide content", () => {
  test("uses the title placeholder even when it is not the first shape", async () => {
    const md = await convert(
      [{ file: 1, shapes: textShape("Body first") + textShape("Real Title", "title") }],
      [1]
    );
    expect(md).toContain("## Slide 1: Real Title\n\nBody first");
  });

  test("accepts centered title placeholders", async () => {
    const md = await convert([{ file: 1, shapes: textShape("Deck Name", "ctrTitle") }], [1]);
    expect(md).toContain("## Slide 1: Deck Name");
  });

  test("converts slide tables to Markdown tables and leaves merged cells empty", async () => {
    const table = tableShape([
      ["Region", "Q1"],
      ["North|East", "10"],
    ]).replace('<a:tc><a:txBody><a:p><a:r><a:t>10', '<a:tc hMerge="1"><a:txBody><a:p><a:r><a:t>10');
    const md = await convert(
      [{ file: 1, shapes: textShape("Sales", "title") + table }],
      [1]
    );
    expect(md).toContain("| Region | Q1 |\n| --- | --- |\n| North\\|East |  |");
  });

  test("labels hidden slides", async () => {
    const md = await convert(
      [{ file: 1, shapes: textShape("Backup", "title"), hidden: true }],
      [1]
    );
    expect(md).toContain("## Slide 1: Backup _(hidden)_");
  });

  test("drops slide-number, date, and footer placeholders from slides and notes", async () => {
    const md = await convert(
      [
        {
          file: 1,
          shapes:
            textShape("Agenda", "title") +
            textShape("Item one") +
            textShape("7", "sldNum") +
            textShape("1/1/2026", "dt") +
            textShape("Confidential", "ftr"),
          notes: textShape("Mention item one", "body") + textShape("7", "sldNum"),
        },
      ],
      [1]
    );
    expect(md).toBe("## Slide 1: Agenda\n\nItem one\n\n### Notes\n\nMention item one");
  });

  test("decodes entities and turns line breaks into spaces", async () => {
    const shape = textShape("Tom &amp; Jerry").replace(
      "</a:t></a:r></a:p>",
      "</a:t></a:r><a:br/><a:r><a:t>forever</a:t></a:r></a:p>"
    );
    const md = await convert([{ file: 1, shapes: shape }], [1]);
    expect(md).toContain("Tom & Jerry forever");
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
