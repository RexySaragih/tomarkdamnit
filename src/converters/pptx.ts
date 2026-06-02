import { existsSync, readFileSync } from "fs";
import { unzipSync } from "fflate";

/**
 * Minimal XML text extractor — pulls all text from <a:t> tags
 * which is where PowerPoint stores text runs.
 */
function extractTextFromSlideXml(xml: string): string[] {
  const lines: string[] = [];

  // Each <a:p> is a paragraph
  const paragraphs = xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? [];

  for (const para of paragraphs) {
    // Collect all text runs <a:t>...</a:t> within this paragraph
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

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    );
}

export async function pptxToMarkdown(filepath: string): Promise<string> {
  if (!existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  // PPTX is a ZIP archive — extract entirely in memory, no temp files needed
  const fileBuffer = readFileSync(filepath);
  let zipEntries: Record<string, Uint8Array>;

  try {
    zipEntries = unzipSync(new Uint8Array(fileBuffer));
  } catch (err: any) {
    throw new Error(`Failed to read PPTX file (not a valid ZIP): ${err?.message ?? err}`);
  }

  // Collect slide XML files: ppt/slides/slide1.xml, slide2.xml, ...
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

  const sections: string[] = [];

  for (let i = 0; i < slideEntries.length; i++) {
    const [, data] = slideEntries[i];
    const xml = new TextDecoder().decode(data);
    const lines = extractTextFromSlideXml(xml);

    if (lines.length === 0) continue;

    const [title, ...body] = lines;
    const slideNum = i + 1;

    if (body.length > 0) {
      sections.push(`## Slide ${slideNum}: ${title}\n\n${body.join("\n")}`);
    } else {
      sections.push(`## Slide ${slideNum}: ${title}`);
    }
  }

  if (sections.length === 0) {
    return "_No extractable text found in this PPTX._";
  }

  return sections.join("\n\n---\n\n");
}
