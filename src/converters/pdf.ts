import pdfParse from "pdf-parse";
import { PDF_MAGIC } from "../shared/constants.js";
import { assertReadableFile, readFileBuffer } from "../shared/fs.js";
import { assertMagic } from "../shared/magic.js";

export async function pdfToMarkdown(filepath: string): Promise<string> {
  const absolutePath = await assertReadableFile(filepath, {
    extensions: [".pdf"],
  });
  const dataBuffer = await readFileBuffer(absolutePath);
  assertMagic(dataBuffer, [PDF_MAGIC], "PDF");

  const data = await pdfParse(dataBuffer);

  const text: string = data.text ?? "";
  if (!text.trim()) {
    return "_No extractable text found in this PDF (it may be image-based)._";
  }

  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const pageNote =
    typeof data.numpages === "number" && data.numpages > 0
      ? `_Extracted plain text from ${data.numpages} page(s). Structured headings/layout are not reconstructed._\n\n`
      : `_Extracted plain text. Structured headings/layout are not reconstructed._\n\n`;

  return pageNote + cleaned;
}
