declare module "pdf-parse" {
  import type { Buffer } from "node:buffer";

  interface PDFData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    text: string;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PDFData>;
  export default pdfParse;
}
