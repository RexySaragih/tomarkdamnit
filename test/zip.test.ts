import { describe, expect, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import { unzipOfficePackage, ZipLimitError } from "../src/shared/zip.ts";

const LOCAL_HEADER_SIZE = 30;

/** Overwrites the first entry's compressed bytes so inflating it would fail. */
function corruptFirstEntryData(zip: Uint8Array, nameLength: number): Uint8Array {
  const copy = new Uint8Array(zip);
  const start = LOCAL_HEADER_SIZE + nameLength;
  copy.fill(0xff, start, start + 8);
  return copy;
}

describe("unzipOfficePackage", () => {
  test("unzips a small package", () => {
    const zipped = zipSync({ "ppt/slides/slide1.xml": strToU8("<a/>") });
    const entries = unzipOfficePackage(zipped);
    expect(Object.keys(entries)).toContain("ppt/slides/slide1.xml");
  });

  test("rejects too many entries", () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 10; i++) files[`f${i}.xml`] = strToU8("<a/>");
    expect(() => unzipOfficePackage(zipSync(files), { maxEntries: 5 })).toThrow(
      /too many entries/
    );
  });

  test("rejects oversized uncompressed payload", () => {
    const zipped = zipSync({ "big.bin": new Uint8Array(10_000) });
    expect(() =>
      unzipOfficePackage(zipped, { maxUncompressedBytes: 100 })
    ).toThrow(/uncompressed size exceeds/);
  });

  test("rejects by declared size before inflating any data", () => {
    const name = "bomb.bin";
    const zipped = zipSync({ [name]: new Uint8Array(1_000_000) });
    const corrupted = corruptFirstEntryData(zipped, name.length);

    // Inflating the corrupted entry would raise a parse error; a limit error
    // proves the entry was rejected from its declared size alone.
    expect(() =>
      unzipOfficePackage(corrupted, { maxUncompressedBytes: 1_000 })
    ).toThrow(ZipLimitError);
    expect(() => unzipOfficePackage(corrupted)).toThrow(
      /Failed to read Office ZIP package/
    );
  });

  test("decompresses only included entries, and excluded ones do not count toward size", () => {
    const zipped = zipSync({
      "ppt/slides/slide1.xml": strToU8("<a/>"),
      "ppt/media/huge.png": new Uint8Array(50_000),
    });
    const entries = unzipOfficePackage(zipped, {
      maxUncompressedBytes: 1_000,
      include: (name) => name.startsWith("ppt/slides/"),
    });
    expect(Object.keys(entries)).toEqual(["ppt/slides/slide1.xml"]);
  });
});
