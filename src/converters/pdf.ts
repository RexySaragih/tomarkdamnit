import { readFile } from "fs/promises";
import { existsSync } from "fs";

export async function pdfToMarkdown(filepath: string): Promise<string> {
  if (!existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  const dataBuffer = await readFile(filepath);

  // pdf-parse is a CommonJS module — use a dynamic import workaround
  const pdfParse = await import("pdf-parse/lib/pdf-parse.js").catch(
    () => import("pdf-parse" as any)
  );

  const parseFn =
    typeof pdfParse === "function"
      ? pdfParse
      : (pdfParse as any).default ?? pdfParse;

  const data = await parseFn(dataBuffer);

  const text: string = data.text ?? "";
  if (!text.trim()) {
    return "_No extractable text found in this PDF (it may be image-based)._";
  }

  // Basic cleanup: collapse excessive blank lines
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}
