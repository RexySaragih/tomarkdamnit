import { lstat, readFile, realpath, stat } from "fs/promises";
import { isAbsolute, resolve, sep } from "path";
import { ALLOWED_DIRS_ENV, getMaxFileBytes } from "./constants.js";

export interface AssertReadableFileOptions {
  extensions: string[];
  maxBytes?: number;
}

async function getAllowedDirs(): Promise<string[]> {
  const raw = process.env[ALLOWED_DIRS_ENV];
  if (!raw?.trim()) return [];

  const dirs: string[] = [];
  for (const entry of raw.split(",").map((d) => d.trim()).filter(Boolean)) {
    try {
      dirs.push(await realpath(resolve(entry)));
    } catch {
      dirs.push(resolve(entry));
    }
  }
  return dirs;
}

function isInsideDir(filePath: string, dir: string): boolean {
  const normalizedDir = dir.endsWith(sep) ? dir : dir + sep;
  return filePath === dir || filePath.startsWith(normalizedDir);
}

export async function assertReadableFile(
  filepath: string,
  options: AssertReadableFileOptions
): Promise<string> {
  if (!filepath?.trim()) {
    throw new Error("filepath is required");
  }

  if (!isAbsolute(filepath)) {
    throw new Error(
      `filepath must be an absolute path. Received: "${filepath}"`
    );
  }

  const absolutePath = resolve(filepath);
  const ext = absolutePath.toLowerCase().slice(absolutePath.lastIndexOf("."));
  const allowed = options.extensions.map((e) => e.toLowerCase());
  if (!allowed.includes(ext)) {
    throw new Error(
      `Unsupported file extension "${ext}". Expected one of: ${allowed.join(", ")}`
    );
  }

  let linkInfo;
  try {
    linkInfo = await lstat(absolutePath);
  } catch {
    throw new Error(`File not found: ${absolutePath}`);
  }

  if (linkInfo.isSymbolicLink()) {
    throw new Error(`Symbolic links are not allowed: ${absolutePath}`);
  }
  if (!linkInfo.isFile()) {
    throw new Error(`Not a file: ${absolutePath}`);
  }

  let resolvedPath: string;
  try {
    resolvedPath = await realpath(absolutePath);
  } catch {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const allowedDirs = await getAllowedDirs();
  if (
    allowedDirs.length > 0 &&
    !allowedDirs.some((dir) => isInsideDir(resolvedPath, dir))
  ) {
    throw new Error(
      `Path is outside TOMARK_ALLOWED_DIRS: ${resolvedPath}`
    );
  }

  const info = await stat(resolvedPath);
  if (!info.isFile()) {
    throw new Error(`Not a file: ${resolvedPath}`);
  }

  const maxBytes = options.maxBytes ?? getMaxFileBytes();
  if (info.size > maxBytes) {
    throw new Error(
      `File too large (${info.size.toLocaleString()} bytes). Max allowed is ${maxBytes.toLocaleString()} bytes.`
    );
  }

  return resolvedPath;
}

export async function readFileBuffer(filepath: string): Promise<Buffer> {
  return readFile(filepath);
}
