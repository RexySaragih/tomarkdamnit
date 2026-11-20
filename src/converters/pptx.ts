import { getMaxPptxSlides, ZIP_MAGIC } from "../shared/constants.js";
import { assertReadableFile, readFileBuffer } from "../shared/fs.js";
import { assertMagic } from "../shared/magic.js";
import { parseRelationships, resolvePartPath } from "../shared/ooxml.js";
import {
  parseNotesXml,
  parseSlideXml,
  type ParsedSlide,
  type SlideBlock,
} from "../shared/pptx-xml.js";
import { unzipOfficePackage } from "../shared/zip.js";

type PackageEntries = Record<string, Uint8Array>;

// Media (images, video, embedded workbooks) is never needed for text output.
const TEXT_PART_PATTERN =
  /^ppt\/(presentation\.xml|_rels\/presentation\.xml\.rels|slides\/(_rels\/)?slide\d+\.xml(\.rels)?|notesSlides\/notesSlide\d+\.xml)$/;
const SLIDE_PATH = /^ppt\/slides\/slide\d+\.xml$/;
const NOTES_PATH = /^ppt\/notesSlides\/notesSlide\d+\.xml$/;
const SLIDE_ID_TAG = /<p:sldId\b[^>]*\br:id="([^"]+)"/g;
const NOTES_REL_TYPE = /\/notesSlide$/;

const decoder = new TextDecoder();

function isTextPart(entryName: string): boolean {
  return TEXT_PART_PATTERN.test(entryName);
}

function readPart(entries: PackageEntries, path: string): string | undefined {
  const data = entries[path];
  return data ? decoder.decode(data) : undefined;
}

function slideFileNumber(path: string): number {
  return parseInt(path.match(/slide(\d+)\.xml$/)?.[1] ?? "0", 10);
}

function slidesByFileName(entries: PackageEntries): string[] {
  return Object.keys(entries)
    .filter((path) => SLIDE_PATH.test(path))
    .sort((a, b) => slideFileNumber(a) - slideFileNumber(b));
}

/**
 * Presentation order lives in presentation.xml (p:sldIdLst), not in slide
 * file names; reordered decks keep their original file numbers.
 */
function slidesInPresentationOrder(entries: PackageEntries): string[] {
  const presentation = readPart(entries, "ppt/presentation.xml");
  const rels = readPart(entries, "ppt/_rels/presentation.xml.rels");
  if (!presentation || !rels) return slidesByFileName(entries);

  const targets = new Map(
    parseRelationships(rels).map((rel) => [rel.id, rel.target])
  );
  const ordered: string[] = [];
  for (const [, relId] of presentation.matchAll(SLIDE_ID_TAG)) {
    const target = targets.get(relId);
    const path = target && resolvePartPath("ppt", target, SLIDE_PATH);
    if (path && entries[path] && !ordered.includes(path)) ordered.push(path);
  }
  return ordered.length > 0 ? ordered : slidesByFileName(entries);
}

function notesPathForSlide(
  entries: PackageEntries,
  slidePath: string
): string | undefined {
  const relsPath = slidePath.replace(
    /slides\/(slide\d+\.xml)$/,
    "slides/_rels/$1.rels"
  );
  const rels = readPart(entries, relsPath);
  if (!rels) return undefined;
  const notesRel = parseRelationships(rels).find(
    (rel) => !rel.external && NOTES_REL_TYPE.test(rel.type)
  );
  return notesRel
    ? resolvePartPath("ppt/slides", notesRel.target, NOTES_PATH)
    : undefined;
}

const HIDDEN_LABEL = "_(hidden)_";

function blockToMarkdown(block: SlideBlock): string {
  return block.kind === "table" ? block.markdown : block.lines.join("\n");
}

/**
 * Without a title placeholder, fall back to treating the first line as the
 * title when the slide has more than one line (pre-1.3 behaviour).
 */
function splitTitle(slide: ParsedSlide): { title?: string; blocks: SlideBlock[] } {
  if (slide.title !== undefined) return { title: slide.title, blocks: slide.blocks };

  const [first, ...rest] = slide.blocks;
  const lineCount = slide.blocks.reduce(
    (sum, block) => sum + (block.kind === "text" ? block.lines.length : 1),
    0
  );
  if (first?.kind !== "text" || lineCount < 2) return { blocks: slide.blocks };

  const [title, ...remaining] = first.lines;
  const blocks: SlideBlock[] =
    remaining.length > 0 ? [{ kind: "text", lines: remaining }, ...rest] : rest;
  return { title, blocks };
}

function formatSlideSection(
  slideNum: number,
  slide: ParsedSlide,
  notes: string[]
): string {
  const { title, blocks } = splitTitle(slide);
  const heading = [
    `## Slide ${slideNum}${title ? `: ${title}` : ""}`,
    slide.hidden ? ` ${HIDDEN_LABEL}` : "",
  ].join("");

  const parts = [heading, ...blocks.map(blockToMarkdown)];
  if (notes.length > 0) parts.push(`### Notes\n\n${notes.join("\n")}`);
  return parts.join("\n\n");
}

function convertSlide(
  entries: PackageEntries,
  slidePath: string,
  slideNum: number
): string | undefined {
  const slide = parseSlideXml(readPart(entries, slidePath) ?? "");
  const notesPath = notesPathForSlide(entries, slidePath);
  const notesXml = notesPath ? readPart(entries, notesPath) : undefined;
  const notes = notesXml ? parseNotesXml(notesXml) : [];

  const isEmpty = slide.title === undefined && slide.blocks.length === 0;
  if (isEmpty && notes.length === 0) return undefined;
  return formatSlideSection(slideNum, slide, notes);
}

export async function pptxToMarkdown(filepath: string): Promise<string> {
  const absolutePath = await assertReadableFile(filepath, {
    extensions: [".pptx"],
  });
  const fileBuffer = await readFileBuffer(absolutePath);
  assertMagic(fileBuffer, [ZIP_MAGIC], "PPTX (ZIP/OOXML)");

  const entries = unzipOfficePackage(fileBuffer, { include: isTextPart });
  const slidePaths = slidesInPresentationOrder(entries);
  if (slidePaths.length === 0) return "_No slides found in this PPTX._";

  const maxSlides = getMaxPptxSlides();
  const sections = slidePaths
    .slice(0, maxSlides)
    .map((path, index) => convertSlide(entries, path, index + 1))
    .filter((section): section is string => section !== undefined);

  if (sections.length === 0) return "_No extractable text found in this PPTX._";

  let result = sections.join("\n\n---\n\n");
  if (slidePaths.length > maxSlides) {
    result += `\n\n_Slides truncated to ${maxSlides.toLocaleString()} slides._`;
  }
  return result;
}
