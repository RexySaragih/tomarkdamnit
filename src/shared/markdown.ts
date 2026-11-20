import { getMaxOutputChars } from "./constants.js";

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

/**
 * Convert a 2D string grid into a GitHub-flavored Markdown table.
 * The first row is treated as the header.
 */
export function rowsToMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return "";

  const maxCols = Math.max(...rows.map((r) => r.length));
  if (maxCols === 0) return "";

  const padded = rows.map((row) => {
    const cells = row.map((cell) => escapeCell(cell ?? ""));
    while (cells.length < maxCols) cells.push("");
    return cells;
  });

  let effectiveCols = maxCols;
  while (effectiveCols > 1) {
    const col = effectiveCols - 1;
    if (padded.every((r) => r[col] === "")) {
      effectiveCols -= 1;
    } else {
      break;
    }
  }

  const trimmed = padded.map((r) => r.slice(0, effectiveCols));
  const header = `| ${trimmed[0].join(" | ")} |`;
  const separator = `| ${trimmed[0].map(() => "---").join(" | ")} |`;
  const body = trimmed
    .slice(1)
    .map((r) => `| ${r.join(" | ")} |`)
    .join("\n");

  return body ? `${header}\n${separator}\n${body}` : `${header}\n${separator}`;
}

export function truncateMarkdown(markdown: string): string {
  const maxChars = getMaxOutputChars();
  if (markdown.length <= maxChars) return markdown;
  const notice = `\n\n_Output truncated at ${maxChars.toLocaleString()} characters._`;
  const keep = Math.max(0, maxChars - notice.length);
  return markdown.slice(0, keep) + notice;
}
