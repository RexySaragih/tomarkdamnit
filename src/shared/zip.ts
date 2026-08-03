import { unzipSync } from "fflate";
import {
  getMaxZipEntries,
  getMaxZipUncompressedBytes,
} from "./constants.js";

export interface UnzipOfficeOptions {
  maxEntries?: number;
  maxUncompressedBytes?: number;
}

export function unzipOfficePackage(
  buffer: Uint8Array | Buffer,
  options: UnzipOfficeOptions = {}
): Record<string, Uint8Array> {
  const maxEntries = options.maxEntries ?? getMaxZipEntries();
  const maxUncompressedBytes =
    options.maxUncompressedBytes ?? getMaxZipUncompressedBytes();

  let zipEntries: Record<string, Uint8Array>;
  try {
    zipEntries = unzipSync(new Uint8Array(buffer));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read Office ZIP package: ${message}`);
  }

  const entries = Object.entries(zipEntries);
  if (entries.length > maxEntries) {
    throw new Error(
      `ZIP has too many entries (${entries.length}). Max allowed is ${maxEntries}.`
    );
  }

  let total = 0;
  for (const [, data] of entries) {
    total += data.byteLength;
    if (total > maxUncompressedBytes) {
      throw new Error(
        `ZIP uncompressed size exceeds limit of ${maxUncompressedBytes.toLocaleString()} bytes.`
      );
    }
  }

  return zipEntries;
}
