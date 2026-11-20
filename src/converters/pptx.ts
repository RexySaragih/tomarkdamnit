import { getMaxPptxSlides, ZIP_MAGIC } from "../shared/constants.js";
import { assertReadableFile, readFileBuffer } from "../shared/fs.js";
import { assertMagic } from "../shared/magic.js";
import { parseRelationships, resolvePartPath } from "../shared/ooxml.js";
import { decodeXmlEntities } from "../shared/xml.js";
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

function extractTextFromSlideXml(xml: string): string[] {
  const lines: string[] = [];
  const paragraphs = xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? [];

  for (const para of paragraphs) {
    const runs = para.match(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g) ?? [];
    const text = runs
      .map((r) => r.replace(/<a:t(?:\s[^>]*)?>/, "").replace(/<\/a:t>/, ""))
      .map(decodeXmlEntities)
      .join("");
    if (text.trim()) lines.push(text.trim());
  }

  return lines;
}

function formatSlideSection(
  slideNum: number,
  lines: string[],
  notes: string[]
): string {
  const parts: string[] = [];

  if (lines.length === 0) {
    parts.push(`## Slide ${slideNum}`);
  } else if (lines.length === 1) {
    parts.push(`## Slide ${slideNum}\n\n${lines[0]}`);
  } else {
    const [title, ...body] = lines;
    parts.push(`## Slide ${slideNum}: ${title}\n\n${body.join("\n")}`);
  }

  if (notes.length > 0) {
    parts.push(`### Notes\n\n${notes.join("\n")}`);
  }

  return parts.join("\n\n");
}

function convertSlide(
  entries: PackageEntries,
  slidePath: string,
  slideNum: number
): string | undefined {
  const lines = extractTextFromSlideXml(readPart(entries, slidePath) ?? "");
  const notesPath = notesPathForSlide(entries, slidePath);
  const notesXml = notesPath ? readPart(entries, notesPath) : undefined;
  const notes = notesXml ? extractTextFromSlideXml(notesXml) : [];

  if (lines.length === 0 && notes.length === 0) return undefined;
  return formatSlideSection(slideNum, lines, notes);
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
