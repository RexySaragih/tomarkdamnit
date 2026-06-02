import mammoth from "mammoth";
import TurndownService from "turndown";
import { existsSync } from "fs";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

// Preserve table structure in turndown
turndown.addRule("table", {
  filter: ["table"],
  replacement(_content, node) {
    // Walk the DOM manually via the node object
    const rows: string[][] = [];
    const table = node as Element;

    Array.from(table.querySelectorAll("tr")).forEach((tr) => {
      const cells: string[] = [];
      Array.from(tr.querySelectorAll("td, th")).forEach((cell) => {
        cells.push(cell.textContent?.replace(/\n/g, " ").trim() ?? "");
      });
      rows.push(cells);
    });

    if (rows.length === 0) return "";

    const maxCols = Math.max(...rows.map((r) => r.length));
    const padded = rows.map((r) => {
      while (r.length < maxCols) r.push("");
      return r;
    });

    const header = `| ${padded[0].join(" | ")} |`;
    const separator = `| ${padded[0].map(() => "---").join(" | ")} |`;
    const body = padded
      .slice(1)
      .map((r) => `| ${r.join(" | ")} |`)
      .join("\n");

    return `\n\n${header}\n${separator}\n${body}\n\n`;
  },
});

export async function docxToMarkdown(filepath: string): Promise<string> {
  if (!existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  const result = await mammoth.convertToHtml({ path: filepath });

  if (result.messages.length > 0) {
    const warnings = result.messages
      .filter((m) => m.type === "warning")
      .map((m) => m.message)
      .join("; ");
    if (warnings) {
      console.warn("[docx] Warnings:", warnings);
    }
  }

  const markdown = turndown.turndown(result.value);
  return markdown.trim();
}
