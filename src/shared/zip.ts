import { unzipSync, type UnzipFileInfo } from "fflate";
import {
  getMaxZipEntries,
  getMaxZipUncompressedBytes,
} from "./constants.js";

export interface UnzipOfficeOptions {
  maxEntries?: number;
  maxUncompressedBytes?: number;
  /** Only entries for which this returns true are decompressed. */
  include?: (entryName: string) => boolean;
}

export class ZipLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipLimitError";
  }
}

function tooManyEntries(count: number, max: number): ZipLimitError {
  return new ZipLimitError(
    `ZIP has too many entries (${count}). Max allowed is ${max}.`
  );
}

function tooLarge(max: number): ZipLimitError {
  return new ZipLimitError(
    `ZIP uncompressed size exceeds limit of ${max.toLocaleString()} bytes.`
  );
}

/**
 * Checks limits from the central directory before any entry is inflated,
 * so a ZIP bomb is rejected without allocating its decompressed size.
 */
function createLimitFilter(
  maxEntries: number,
  maxBytes: number,
  include: (entryName: string) => boolean
): (file: UnzipFileInfo) => boolean {
  let entryCount = 0;
  let declaredBytes = 0;
  return (file) => {
    entryCount += 1;
    if (entryCount > maxEntries) throw tooManyEntries(entryCount, maxEntries);
    if (!include(file.name)) return false;
    declaredBytes += file.originalSize;
    if (declaredBytes > maxBytes) throw tooLarge(maxBytes);
    return true;
  };
}

// Declared sizes come from the archive and can be forged, so verify actual output too.
function assertActualSize(
  entries: Record<string, Uint8Array>,
  maxBytes: number
): void {
  let total = 0;
  for (const data of Object.values(entries)) {
    total += data.byteLength;
    if (total > maxBytes) throw tooLarge(maxBytes);
  }
}

export function unzipOfficePackage(
  buffer: Uint8Array | Buffer,
  options: UnzipOfficeOptions = {}
): Record<string, Uint8Array> {
  const maxEntries = options.maxEntries ?? getMaxZipEntries();
  const maxBytes =
    options.maxUncompressedBytes ?? getMaxZipUncompressedBytes();
  const filter = createLimitFilter(
    maxEntries,
    maxBytes,
    options.include ?? (() => true)
  );

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(buffer), { filter });
  } catch (err: unknown) {
    if (err instanceof ZipLimitError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read Office ZIP package: ${message}`);
  }

  assertActualSize(entries, maxBytes);
  return entries;
}
