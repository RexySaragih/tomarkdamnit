import { createRequire } from "node:module";
import { envInt } from "./env.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

export const PACKAGE_VERSION = pkg.version;

const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_CHARS = 500_000;
const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_YOUTUBE_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ZIP_ENTRIES = 5_000;
const DEFAULT_MAX_ZIP_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const DEFAULT_MAX_PPTX_SLIDES = 500;

export function getMaxFileBytes(): number {
  return envInt("TOMARK_MAX_FILE_BYTES", DEFAULT_MAX_FILE_BYTES);
}

export function getMaxOutputChars(): number {
  return envInt("TOMARK_MAX_OUTPUT_CHARS", DEFAULT_MAX_OUTPUT_CHARS);
}

export function getMaxConcurrent(): number {
  return envInt("TOMARK_MAX_CONCURRENT", DEFAULT_MAX_CONCURRENT);
}

export function getYoutubeTimeoutMs(): number {
  return envInt("TOMARK_YOUTUBE_TIMEOUT_MS", DEFAULT_YOUTUBE_TIMEOUT_MS);
}

export function getMaxZipEntries(): number {
  return envInt("TOMARK_MAX_ZIP_ENTRIES", DEFAULT_MAX_ZIP_ENTRIES);
}

export function getMaxZipUncompressedBytes(): number {
  return envInt(
    "TOMARK_MAX_ZIP_UNCOMPRESSED_BYTES",
    DEFAULT_MAX_ZIP_UNCOMPRESSED_BYTES
  );
}

export function getMaxPptxSlides(): number {
  return envInt("TOMARK_MAX_PPTX_SLIDES", DEFAULT_MAX_PPTX_SLIDES);
}

/** @deprecated Prefer getMaxFileBytes() — kept for call sites that need a number at import time. */
export const MAX_FILE_BYTES = DEFAULT_MAX_FILE_BYTES;

/** @deprecated Prefer getMaxOutputChars() */
export const MAX_OUTPUT_CHARS = DEFAULT_MAX_OUTPUT_CHARS;

export const YOUTUBE_CHUNK_SECONDS_DEFAULT = 30;
export const YOUTUBE_CHUNK_SECONDS_MIN = 5;
export const YOUTUBE_CHUNK_SECONDS_MAX = 300;

export const XLSX_MAX_ROWS = 5_000;
export const XLSX_MAX_COLS = 100;

export const ALLOWED_DIRS_ENV = "TOMARK_ALLOWED_DIRS";
export const DEBUG_ENV = "TOMARK_DEBUG";

export const PDF_MAGIC = Buffer.from("%PDF");
export const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
/** OLE Compound Document magic (legacy .xls) */
export const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
