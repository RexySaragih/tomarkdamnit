import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { assertReadableFile } from "../src/shared/fs.ts";

const fixture = join(import.meta.dir, "fixtures", "sample.pdf");

afterEach(() => {
  delete process.env.TOMARK_ALLOWED_DIRS;
});

describe("assertReadableFile", () => {
  test("accepts a valid absolute fixture path", async () => {
    const path = await assertReadableFile(fixture, { extensions: [".pdf"] });
    expect(path.endsWith("sample.pdf")).toBe(true);
  });

  test("rejects relative paths", async () => {
    await expect(
      assertReadableFile("fixtures/sample.pdf", { extensions: [".pdf"] })
    ).rejects.toThrow(/absolute path/);
  });

  test("rejects missing files", async () => {
    await expect(
      assertReadableFile("/tmp/tomarkdamnit-does-not-exist.pdf", {
        extensions: [".pdf"],
      })
    ).rejects.toThrow(/File not found/);
  });

  test("rejects wrong extension", async () => {
    await expect(
      assertReadableFile(fixture, { extensions: [".docx"] })
    ).rejects.toThrow(/Unsupported file extension/);
  });

  test("enforces allowlist when set", async () => {
    process.env.TOMARK_ALLOWED_DIRS = "/tmp";
    await expect(
      assertReadableFile(fixture, { extensions: [".pdf"] })
    ).rejects.toThrow(/TOMARK_ALLOWED_DIRS/);
  });

  test("allows paths inside allowlist", async () => {
    process.env.TOMARK_ALLOWED_DIRS = join(import.meta.dir, "fixtures");
    const path = await assertReadableFile(fixture, { extensions: [".pdf"] });
    expect(path.endsWith("sample.pdf")).toBe(true);
  });

  test("rejects symlinks even inside allowlist", async () => {
    const root = join(tmpdir(), `tomark-symlink-${Date.now()}`);
    const allowed = join(root, "allowed");
    mkdirSync(allowed, { recursive: true });
    const linkPath = join(allowed, "hosts.pdf");
    symlinkSync("/etc/hosts", linkPath);
    process.env.TOMARK_ALLOWED_DIRS = allowed;

    try {
      await expect(
        assertReadableFile(linkPath, { extensions: [".pdf"] })
      ).rejects.toThrow(/Symbolic links are not allowed/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects when realpath escapes allowlist via hard path tricks", async () => {
    const root = join(tmpdir(), `tomark-escape-${Date.now()}`);
    const allowed = join(root, "allowed");
    mkdirSync(allowed, { recursive: true });
    writeFileSync(join(allowed, "ok.pdf"), "%PDF-1.4\n");
    process.env.TOMARK_ALLOWED_DIRS = allowed;

    try {
      await expect(
        assertReadableFile(join(root, "outside.pdf"), { extensions: [".pdf"] })
      ).rejects.toThrow(/File not found|TOMARK_ALLOWED_DIRS/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
