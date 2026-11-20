<p align="center">
  <img src="assets/tomarkdamnit-github-logo.png" alt="tomarkdamnit" width="180" height="180" />
</p>

# tomarkdamnit

An MCP (Model Context Protocol) server that converts documents and YouTube videos to Markdown — right inside your AI assistant.

Supports PDF, DOCX, XLSX, PPTX, and YouTube transcripts.

Requires **Node.js 20.18.1+ (20.x) or 22.3.0+**.

---

## Tools

| Tool                  | Input                           | What it does                                                                                 |
| --------------------- | ------------------------------- | -------------------------------------------------------------------------------------------- |
| `pdf_to_markdown`     | `filepath`                      | Extracts plain text from a PDF (no OCR / layout reconstruction)                              |
| `docx_to_markdown`    | `filepath`                      | Converts a Word document to Markdown, preserving headings, bold, italic, lists, and tables   |
| `xlsx_to_markdown`    | `filepath`                      | Converts an Excel workbook (`.xlsx`/`.xlsm`/`.xls`) to Markdown — each sheet becomes a table |
| `pptx_to_markdown`    | `filepath`                      | Extracts slide titles, text, tables, and speaker notes, in presentation order                |
| `youtube_to_markdown` | `url`, `lang?`, `chunkSeconds?` | Fetches a YouTube transcript and returns it as timestamped Markdown                          |

All tools are marked read-only. The four file tools are also marked closed-world (no network), so MCP clients can treat them as safe to auto-approve.

---

## Installation

No local clone needed. Run directly via `npx`:

```bash
npx -y @rexymayderio/tomarkdamnit
```

---

## Usage with an MCP client

### Cursor

```json
{
  "mcpServers": {
    "tomarkdamnit": {
      "command": "npx",
      "args": ["-y", "@rexymayderio/tomarkdamnit"]
    }
  }
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "tomarkdamnit": {
      "command": "npx",
      "args": ["-y", "@rexymayderio/tomarkdamnit"]
    }
  }
}
```

Once configured:

> "Convert `/Users/me/reports/q1.pdf` to Markdown"

> "Get the transcript from https://www.youtube.com/watch?v=dQw4w9WgXcQ"

---

## Environment variables

| Variable                            | Purpose                                                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `TOMARK_ALLOWED_DIRS`               | Optional comma-separated absolute directories. When set, file tools only read **realpath** targets inside these dirs. Symlinks are rejected. |
| `TOMARK_MAX_FILE_BYTES`             | Max input file size (default `52428800` / 50 MiB)                                                                                            |
| `TOMARK_MAX_OUTPUT_CHARS`           | Max Markdown output length (default `500000`)                                                                                                |
| `TOMARK_MAX_CONCURRENT`             | Max concurrent tool executions (default `2`)                                                                                                 |
| `TOMARK_YOUTUBE_TIMEOUT_MS`         | YouTube fetch timeout (default `30000`)                                                                                                      |
| `TOMARK_MAX_ZIP_ENTRIES`            | Max ZIP entries for PPTX (default `5000`)                                                                                                    |
| `TOMARK_MAX_ZIP_UNCOMPRESSED_BYTES` | Max uncompressed ZIP bytes (default `209715200` / 200 MiB)                                                                                   |
| `TOMARK_MAX_PPTX_SLIDES`            | Max slides to convert (default `500`)                                                                                                        |
| `TOMARK_DEBUG`                      | Set to `1`/`true` to log converter errors to stderr                                                                                          |
| `HTTPS_PROXY` / `HTTP_PROXY`        | Optional proxy for YouTube transcript fetches (undici `ProxyAgent`)                                                                          |

Also accepts lowercase `https_proxy` / `http_proxy`.

---

## Tool details

### `pdf_to_markdown`

Extracts plain text from a PDF via [pdf-parse](https://github.com/mehmet-kozan/pdf-parse) (pdf.js). Scanned PDFs without embedded text return a notice. Layout/headings are not reconstructed; OCR is not performed. Path must be absolute. File must start with `%PDF`.

### `docx_to_markdown`

Converts `.docx` via [mammoth](https://github.com/mwilliamson/mammoth.js) + [Turndown](https://github.com/mixmark-io/turndown). Legacy `.doc` is not supported. Nested tables are handled without flattening into the parent row. Embedded images become placeholders (`![alt text]`, or `![image]` when there is no alt text); image data is never included.

### `xlsx_to_markdown`

Converts `.xlsx` / `.xlsm` via [exceljs](https://github.com/exceljs/exceljs), and legacy `.xls` (BIFF5/BIFF8 OLE) via [SheetJS](https://docs.sheetjs.com/) 0.20.3, installed from the official SheetJS CDN (the npm registry copy stops at the vulnerable 0.18.5). Format is detected from file magic bytes, so a workbook saved with the wrong extension is still handled. Each worksheet becomes a Markdown table. Dates are written as `YYYY-MM-DD` and do not depend on the server's timezone. Formula cells show their cached result. Rows/columns are capped (5000 × 100 by default).

### `pptx_to_markdown`

Reads the PPTX ZIP via [fflate](https://github.com/101arrowz/fflate). Slides follow the order in `presentation.xml`, not file names. For each slide:

- The heading uses the slide's title placeholder (or the first line when there is none).
- Slide tables become Markdown tables.
- Hidden slides are labelled `_(hidden)_`.
- Slide numbers, dates, footers, and headers are left out of slides and notes.
- Speaker notes appear under `### Notes`.

Only slide, notes, and presentation parts are decompressed. ZIP entry and size limits are checked before anything is decompressed.

### `youtube_to_markdown`

Fetches a transcript as timestamped paragraphs (`chunkSeconds` default 30, range 5–300). The header shows the transcript language. If the requested `lang` is not available, the default track is returned and the header says so.

Supported URL forms:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts|embed|live|clip/VIDEO_ID`
- `https://www.youtube-nocookie.com/embed/VIDEO_ID`
- `https://music.youtube.com/watch?v=VIDEO_ID`
- bare 11-character video ID

Spoof hosts (e.g. `notyoutube.com`) are rejected.

---

## Limitations

- PDF: plain-text extraction only (no OCR, no layout reconstruction)
- DOCX: `.docx` only (not `.doc`); images are placeholders, not described
- XLSX: `.xlsx`/`.xlsm` via exceljs; legacy `.xls` via SheetJS
- PPTX: text, tables, and notes; charts, SmartArt, and images are not interpreted
- Installing pulls the SheetJS tarball from `cdn.sheetjs.com`; networks that only allow an internal npm mirror must allow or mirror that URL
- File paths must be absolute; symlinks are rejected
- Large files / sheets / ZIPs are capped (see env vars)

---

## Development

```bash
git clone https://github.com/RexySaragih/tomarkdamnit.git
cd tomarkdamnit
bun install

bun run dev
bun run typecheck
bun test
bun run build
bun run smoke   # runs the built server under Node over stdio, as npx users do
```

Test fixtures are generated by the scripts in `scripts/make-*-fixtures.mjs`.

---

## License

MIT
