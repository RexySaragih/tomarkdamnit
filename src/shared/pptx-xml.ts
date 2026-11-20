import { rowsToMarkdownTable } from "./markdown.js";
import { decodeXmlEntities } from "./xml.js";

export type SlideBlock =
  | { kind: "text"; lines: string[] }
  | { kind: "table"; markdown: string };

export interface ParsedSlide {
  /** Text of the title placeholder, if the slide has one. */
  title?: string;
  blocks: SlideBlock[];
  hidden: boolean;
}

// p:sp never nests p:sp (groups use p:grpSp), so a lazy match per shape is safe.
const SHAPE_OR_FRAME = /<p:sp\b[\s\S]*?<\/p:sp>|<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g;
const PARAGRAPH = /<a:p\b[\s\S]*?<\/a:p>/g;
const TEXT_RUN_OR_BREAK = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\b[^>]*\/>/g;
const TABLE = /<a:tbl\b[\s\S]*?<\/a:tbl>/;
const TABLE_ROW = /<a:tr\b[\s\S]*?<\/a:tr>/g;
const TABLE_CELL = /<a:tc\b([^>]*)>([\s\S]*?)<\/a:tc>|<a:tc\b[^>]*\/>/g;
const PLACEHOLDER_TYPE = /<p:ph\b[^>]*\btype="([^"]+)"/;
const HIDDEN_SLIDE = /<p:sld\b[^>]*\bshow="(?:0|false)"/;
const MERGED_CELL = /\b[hv]Merge="(?:1|true)"/;

const TITLE_PLACEHOLDERS = new Set(["title", "ctrTitle"]);
// Slide numbers, dates, footers, and headers repeat on every slide or notes page.
const NOISE_PLACEHOLDERS = new Set(["sldNum", "dt", "ftr", "hdr"]);

function paragraphText(paragraph: string): string {
  let text = "";
  for (const [token, run] of paragraph.matchAll(TEXT_RUN_OR_BREAK)) {
    text += token.startsWith("<a:br") ? " " : decodeXmlEntities(run ?? "");
  }
  return text.replace(/\s+/g, " ").trim();
}

export function textLines(xml: string): string[] {
  return (xml.match(PARAGRAPH) ?? []).map(paragraphText).filter(Boolean);
}

function tableToMarkdown(tableXml: string): string {
  const rows = (tableXml.match(TABLE_ROW) ?? []).map((row) =>
    [...row.matchAll(TABLE_CELL)].map(([, attrs = "", body = ""]) =>
      MERGED_CELL.test(attrs) ? "" : textLines(body).join(" ")
    )
  );
  return rowsToMarkdownTable(rows);
}

function placeholderType(shapeXml: string): string | undefined {
  return shapeXml.match(PLACEHOLDER_TYPE)?.[1];
}

export function parseSlideXml(xml: string): ParsedSlide {
  const slide: ParsedSlide = { blocks: [], hidden: HIDDEN_SLIDE.test(xml) };

  for (const [element] of xml.matchAll(SHAPE_OR_FRAME)) {
    const table = element.match(TABLE)?.[0];
    if (table) {
      const markdown = tableToMarkdown(table);
      if (markdown) slide.blocks.push({ kind: "table", markdown });
      continue;
    }

    const type = placeholderType(element);
    if (type && NOISE_PLACEHOLDERS.has(type)) continue;
    const lines = textLines(element);
    if (lines.length === 0) continue;

    if (type && TITLE_PLACEHOLDERS.has(type) && slide.title === undefined) {
      slide.title = lines.join(" ");
      continue;
    }
    slide.blocks.push({ kind: "text", lines });
  }

  return slide;
}

/** Notes pages reuse slide markup; only their text matters. */
export function parseNotesXml(xml: string): string[] {
  return parseSlideXml(xml).blocks.flatMap((block) =>
    block.kind === "text" ? block.lines : [block.markdown]
  );
}
