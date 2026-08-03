import mammoth from "mammoth";
import TurndownService from "turndown";
import { ZIP_MAGIC } from "../shared/constants.js";
import { assertReadableFile, readFileBuffer } from "../shared/fs.js";
import { assertMagic } from "../shared/magic.js";
import { rowsToMarkdownTable } from "../shared/markdown.js";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

function directTableRows(table: Element): Element[] {
  const rows: Element[] = [];
  for (const child of Array.from(table.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === "tr") {
      rows.push(child);
      continue;
    }
    if (tag === "thead" || tag === "tbody" || tag === "tfoot") {
      for (const grand of Array.from(child.children)) {
        if (grand.tagName.toLowerCase() === "tr") {
          rows.push(grand);
        }
      }
    }
  }
  return rows;
}

function directCells(row: Element): Element[] {
  return Array.from(row.children).filter((el) => {
    const tag = el.tagName.toLowerCase();
    return tag === "td" || tag === "th";
  });
}

function cellTextExcludingNestedTables(cell: Element): string {
  let text = "";
  const walk = (node: Node): void => {
    if (node.nodeType === 3) {
      text += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.tagName.toLowerCase() === "table") return;
    for (const child of Array.from(el.childNodes)) {
      walk(child);
    }
  };
  for (const child of Array.from(cell.childNodes)) {
    walk(child);
  }
  return text;
}

function topLevelNestedTables(cell: Element): Element[] {
  return Array.from(cell.querySelectorAll("table")).filter((table) => {
    let parent = table.parentElement;
    while (parent && parent !== cell) {
      if (parent.tagName.toLowerCase() === "table") return false;
      parent = parent.parentElement;
    }
    return parent === cell;
  });
}

function tableToMarkdown(table: Element): string {
  const rows: string[][] = [];
  const nested: Element[] = [];

  for (const tr of directTableRows(table)) {
    const cells = directCells(tr);
    rows.push(cells.map((cell) => cellTextExcludingNestedTables(cell)));
    for (const cell of cells) {
      nested.push(...topLevelNestedTables(cell));
    }
  }

  if (rows.length === 0) return "";

  const parts = [`\n\n${rowsToMarkdownTable(rows)}\n\n`];
  for (const nestedTable of nested) {
    const md = tableToMarkdown(nestedTable);
    if (md) parts.push(md);
  }
  return parts.join("");
}

turndown.addRule("table", {
  filter: ["table"],
  replacement(_content, node) {
    const table = node as Element;
    // Skip nested tables — parent table rule emits them
    let parent = table.parentElement;
    while (parent) {
      if (parent.tagName.toLowerCase() === "table") return "";
      parent = parent.parentElement;
    }
    return tableToMarkdown(table);
  },
});

export async function docxToMarkdown(filepath: string): Promise<string> {
  const absolutePath = await assertReadableFile(filepath, {
    extensions: [".docx"],
  });

  const buffer = await readFileBuffer(absolutePath);
  assertMagic(buffer, [ZIP_MAGIC], "DOCX (ZIP/OOXML)");

  const result = await mammoth.convertToHtml({ buffer });
  const markdown = turndown.turndown(result.value).trim();

  const warnings = result.messages
    .filter((m) => m.type === "warning")
    .map((m) => m.message);

  if (warnings.length === 0) {
    return markdown;
  }

  const warningBlock = [
    "",
    "_Conversion warnings:_",
    ...warnings.map((w) => `- ${w}`),
  ].join("\n");

  return `${markdown}\n${warningBlock}`;
}
