import { decodeXmlEntities } from "./xml.js";

export interface Relationship {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

const RELATIONSHIP_TAG = /<Relationship\b[^>]*>/g;

function readAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? decodeXmlEntities(match[1]) : undefined;
}

/** Parses a .rels part. Attribute order is not fixed by the spec. */
export function parseRelationships(xml: string): Relationship[] {
  const relationships: Relationship[] = [];
  for (const tag of xml.match(RELATIONSHIP_TAG) ?? []) {
    const id = readAttribute(tag, "Id");
    const target = readAttribute(tag, "Target");
    if (!id || !target) continue;
    relationships.push({
      id,
      target,
      type: readAttribute(tag, "Type") ?? "",
      external: readAttribute(tag, "TargetMode") === "External",
    });
  }
  return relationships;
}

/**
 * Resolves a relationship target against the source part's folder and returns
 * the package path only if it matches `allowed`. Rejects escapes above the
 * package root and NUL bytes, since targets come from untrusted files.
 */
export function resolvePartPath(
  baseDir: string,
  target: string,
  allowed: RegExp
): string | undefined {
  let normalized = target.replace(/\\/g, "/");
  const isAbsolute = normalized.startsWith("/");
  if (isAbsolute) normalized = normalized.slice(1);

  const parts = isAbsolute ? [] : baseDir.split("/").filter(Boolean);
  for (const segment of normalized.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment.includes("\0")) return undefined;
    if (segment === "..") {
      if (parts.length === 0) return undefined;
      parts.pop();
      continue;
    }
    parts.push(segment);
  }

  const resolved = parts.join("/");
  return allowed.test(resolved) ? resolved : undefined;
}
