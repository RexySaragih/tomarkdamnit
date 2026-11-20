import { PDFParse, VerbosityLevel } from "pdf-parse";
import { PDF_MAGIC } from "../shared/constants.js";
import { assertReadableFile, readFileBuffer } from "../shared/fs.js";
import { assertMagic } from "../shared/magic.js";

export const NO_TEXT_MESSAGE =
  "_No extractable text found in this PDF. It is probably scanned or image-based; this tool does not perform OCR._";

async function extractPageTexts(data: Buffer): Promise<string[]> {
  const parser = new PDFParse({
    data: new Uint8Array(data),
    verbosity: VerbosityLevel.ERRORS,
  });
  try {
    const result = await parser.getText({ pageJoiner: "" });
    return result.pages.map((page) => page.text);
  } finally {
    await parser.destroy();
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function pdfToMarkdown(filepath: string): Promise<string> {
  const absolutePath = await assertReadableFile(filepath, {
    extensions: [".pdf"],
  });
  const dataBuffer = await readFileBuffer(absolutePath);
  assertMagic(dataBuffer, [PDF_MAGIC], "PDF");

  const pages = await extractPageTexts(dataBuffer);
  const body = cleanText(pages.map(cleanText).filter(Boolean).join("\n\n"));
  if (!body) return NO_TEXT_MESSAGE;

  const pageNote = `_Extracted plain text from ${pages.length} page(s). Structured headings/layout are not reconstructed._\n\n`;
  return pageNote + body;
}
