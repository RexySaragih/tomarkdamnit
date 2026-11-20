import { getMaxPptxSlides, ZIP_MAGIC } from "../shared/constants.js";
import { assertReadableFile, readFileBuffer } from "../shared/fs.js";
import { assertMagic } from "../shared/magic.js";
import { decodeXmlEntities } from "../shared/xml.js";
import { unzipOfficePackage } from "../shared/zip.js";

function extractTextFromSlideXml(xml: string): string[] {
  const lines: string[] = [];
  const paragraphs = xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? [];

  for (const para of paragraphs) {
    const runs = para.match(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g) ?? [];
    const text = runs
      .map((r) => r.replace(/<a:t(?:\s[^>]*)?>/, "").replace(/<\/a:t>/, ""))
      .map(decodeXmlEntities)
      .join("");

    if (text.trim()) {
      lines.push(text.trim());
    }
  }

  return lines;
}

function parseSlideRels(relsXml: string): string | undefined {
  const noteRel = relsXml.match(
    /Target="([^"]*notesSlides\/notesSlide\d+\.xml)"/
  );
  return noteRel?.[1];
}

function resolveNotesPath(target: string): string | undefined {
  let normalized = target.replace(/\\/g, "/");
  if (normalized.startsWith("/")) normalized = normalized.slice(1);

  // Relationships are relative to ppt/slides/
  const baseParts = ["ppt", "slides"];
  const parts = [...baseParts];
  for (const segment of normalized.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (parts.length === 0) return undefined;
      parts.pop();
      continue;
    }
    if (segment.includes("\0")) return undefined;
    parts.push(segment);
  }

  const resolved = parts.join("/");
  if (!/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(resolved)) {
    return undefined;
  }

  return resolved;
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

export async function pptxToMarkdown(filepath: string): Promise<string> {
  const absolutePath = await assertReadableFile(filepath, {
    extensions: [".pptx"],
  });

  const fileBuffer = await readFileBuffer(absolutePath);
  assertMagic(fileBuffer, [ZIP_MAGIC], "PPTX (ZIP/OOXML)");

  const zipEntries = unzipOfficePackage(fileBuffer);

  const slideEntries = Object.entries(zipEntries)
    .filter(([path]) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort(([a], [b]) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] ?? "0", 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] ?? "0", 10);
      return numA - numB;
    });

  if (slideEntries.length === 0) {
    return "_No slides found in this PPTX._";
  }

  const maxSlides = getMaxPptxSlides();
  const limited = slideEntries.slice(0, maxSlides);
  const truncatedSlides = slideEntries.length > maxSlides;

  const decoder = new TextDecoder();
  const sections: string[] = [];

  for (let i = 0; i < limited.length; i++) {
    const [slidePath, data] = limited[i];
    const xml = decoder.decode(data);
    const lines = extractTextFromSlideXml(xml);
    const slideNum = i + 1;

    let notes: string[] = [];
    const slideId = slidePath.match(/slide(\d+)\.xml$/)?.[1];
    const relsPath = `ppt/slides/_rels/slide${slideId}.xml.rels`;
    const relsData = zipEntries[relsPath];
    if (relsData) {
      const target = parseSlideRels(decoder.decode(relsData));
      if (target) {
        const notesPath = resolveNotesPath(target);
        if (notesPath) {
          const notesData = zipEntries[notesPath];
          if (notesData) {
            notes = extractTextFromSlideXml(decoder.decode(notesData));
          }
        }
      }
    }

    if (lines.length === 0 && notes.length === 0) continue;
    sections.push(formatSlideSection(slideNum, lines, notes));
  }

  if (sections.length === 0) {
    return "_No extractable text found in this PPTX._";
  }

  let result = sections.join("\n\n---\n\n");
  if (truncatedSlides) {
    result += `\n\n_Slides truncated to ${maxSlides.toLocaleString()} slides._`;
  }
  return result;
}
