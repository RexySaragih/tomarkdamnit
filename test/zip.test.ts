import { describe, expect, test } from "bun:test";
import { zipSync, strToU8 } from "fflate";
import { unzipOfficePackage } from "../src/shared/zip.ts";

describe("unzipOfficePackage", () => {
  test("unzips a small package", () => {
    const zipped = zipSync({
      "ppt/slides/slide1.xml": strToU8("<a/>"),
    });
    const entries = unzipOfficePackage(zipped);
    expect(Object.keys(entries)).toContain("ppt/slides/slide1.xml");
  });

  test("rejects too many entries", () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 10; i++) {
      files[`f${i}.xml`] = strToU8("<a/>");
    }
    const zipped = zipSync(files);
    expect(() =>
      unzipOfficePackage(zipped, { maxEntries: 5 })
    ).toThrow(/too many entries/);
  });

  test("rejects oversized uncompressed payload", () => {
    const zipped = zipSync({
      "big.bin": new Uint8Array(10_000),
    });
    expect(() =>
      unzipOfficePackage(zipped, { maxUncompressedBytes: 100 })
    ).toThrow(/uncompressed size exceeds/);
  });
});
