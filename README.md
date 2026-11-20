<p align="center">
  <img src="assets/tomarkdamnit-github-logo.png" alt="tomarkdamnit" width="180" height="180" />
</p>

# tomarkdamnit

An MCP (Model Context Protocol) server that converts documents and YouTube videos to Markdown — right inside your AI assistant.

Supports PDF, DOCX, XLSX, PPTX, and YouTube transcripts.

Requires **Node.js >= 20.18.1**.

---

## Tools

| Tool                  | Input                           | What it does                                                                               |
| --------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| `pdf_to_markdown`     | `filepath`                      | Extracts plain text from a PDF (no OCR / layout reconstruction)                            |
| `docx_to_markdown`    | `filepath`                      | Converts a Word document to Markdown, preserving headings, bold, italic, lists, and tables |
| `xlsx_to_markdown`    | `filepath`                      | Converts an Excel workbook (`.xlsx`/`.xlsm`/`.xls`) to Markdown — each sheet becomes a table |
| `pptx_to_markdown`    | `filepath`                      | Extracts slide text and speaker notes from a PowerPoint file                               |
| `youtube_to_markdown` | `url`, `lang?`, `chunkSeconds?` | Fetches a YouTube transcript and returns it as timestamped Markdown                        |

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

| Variable | Purpose |
| -------- | ------- |
| `TOMARK_ALLOWED_DIRS` | Optional comma-separated absolute directories. When set, file tools only read **realpath** targets inside these dirs. Symlinks are rejected. |
| `TOMARK_MAX_FILE_BYTES` | Max input file size (default `52428800` / 50 MiB) |
| `TOMARK_MAX_OUTPUT_CHARS` | Max Markdown output length (default `500000`) |
| `TOMARK_MAX_CONCURRENT` | Max concurrent tool executions (default `2`) |
| `TOMARK_YOUTUBE_TIMEOUT_MS` | YouTube fetch timeout (default `30000`) |
| `TOMARK_MAX_ZIP_ENTRIES` | Max ZIP entries for PPTX (default `5000`) |
| `TOMARK_MAX_ZIP_UNCOMPRESSED_BYTES` | Max uncompressed ZIP bytes (default `209715200` / 200 MiB) |
| `TOMARK_MAX_PPTX_SLIDES` | Max slides to convert (default `500`) |
| `TOMARK_DEBUG` | Set to `1`/`true` to log converter errors to stderr |
| `HTTPS_PROXY` / `HTTP_PROXY` | Optional proxy for YouTube transcript fetches (undici `ProxyAgent`) |

Also accepts lowercase `https_proxy` / `http_proxy`.

---

## Tool details

### `pdf_to_markdown`

Extracts plain text from a PDF. Scanned PDFs without embedded text return a notice. Layout/headings are not reconstructed; OCR is not performed. Path must be absolute. File must start with `%PDF`.

### `docx_to_markdown`

Converts `.docx` via [mammoth](https://github.com/mwilliamson/mammoth.js) + [Turndown](https://github.com/mixmark-io/turndown). Legacy `.doc` is not supported. Nested tables are handled without flattening into the parent row.

### `xlsx_to_markdown`

Converts `.xlsx` / `.xlsm` via [exceljs](https://github.com/exceljs/exceljs), and legacy `.xls` (BIFF5/BIFF8 OLE) via [xlsjs](https://www.npmjs.com/package/xlsjs). Format is detected from file magic bytes (so a renamed `.xlsx` that is still OLE/BIFF is handled correctly). Each worksheet becomes a Markdown table. Rows/columns are capped (5000 × 100 by default).

### `pptx_to_markdown`

Reads the PPTX ZIP via [fflate](https://github.com/101arrowz/fflate), extracts slide text runs and speaker notes. ZIP entry/uncompressed size limits apply.

### `youtube_to_markdown`

Fetches a transcript as timestamped paragraphs (`chunkSeconds` default 30, range 5–300).

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
- DOCX: `.docx` only (not `.doc`)
- XLSX: `.xlsx`/`.xlsm` via exceljs; legacy `.xls` via xlsjs
- PPTX: text runs + notes; charts/SmartArt not interpreted
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
```

---

## License

MIT
