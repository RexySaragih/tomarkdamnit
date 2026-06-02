# tomarkdamnit

An MCP (Model Context Protocol) server that converts documents and YouTube videos to Markdown — right inside your AI assistant.

Supports PDF, DOCX, XLSX/XLS, PPTX, and YouTube transcripts.

---

## Tools

| Tool                  | Input          | What it does                                                                               |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| `pdf_to_markdown`     | `filepath`     | Extracts all text from a PDF and returns it as Markdown                                    |
| `docx_to_markdown`    | `filepath`     | Converts a Word document to Markdown, preserving headings, bold, italic, lists, and tables |
| `xlsx_to_markdown`    | `filepath`     | Converts an Excel file to Markdown — each sheet becomes a table                            |
| `pptx_to_markdown`    | `filepath`     | Extracts slide titles and body text from a PowerPoint file                                 |
| `youtube_to_markdown` | `url`, `lang?` | Fetches a YouTube transcript and returns it as timestamped Markdown                        |

---

## Installation

Requires [Bun](https://bun.sh) and Node.js.

```bash
# Clone and install dependencies
git clone https://github.com/your-username/tomarkdamnit.git
cd tomarkdamnit
bun install

# Build the binary
bun run build
```

---

## Usage with an MCP client

### Kiro

Add the server to your `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "tomarkdamnit": {
      "command": "node",
      "args": ["/absolute/path/to/tomarkdamnit/dist/index.js"]
    }
  }
}
```

### Claude Desktop

Add it to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tomarkdamnit": {
      "command": "node",
      "args": ["/absolute/path/to/tomarkdamnit/dist/index.js"]
    }
  }
}
```

Once configured, the tools are available in your AI chat. For example:

> "Convert `/Users/me/reports/q1.pdf` to Markdown"

> "Get the transcript from https://www.youtube.com/watch?v=dQw4w9WgXcQ"

---

## Tool Details

### `pdf_to_markdown`

Extracts plain text from a PDF. Image-based (scanned) PDFs without embedded text will return a notice rather than empty output.

```
filepath  — Absolute path to the .pdf file
```

### `docx_to_markdown`

Converts Word documents using [mammoth](https://github.com/mwilliamson/mammoth.js) and [Turndown](https://github.com/mixmark-io/turndown). Tables are preserved as Markdown tables.

```
filepath  — Absolute path to the .docx file
```

### `xlsx_to_markdown`

Converts Excel spreadsheets using [xlsx](https://github.com/SheetJS/sheetjs). Each worksheet becomes its own Markdown table section.

```
filepath  — Absolute path to the .xlsx or .xls file
```

### `pptx_to_markdown`

Extracts text from PowerPoint presentations using [officeparser](https://github.com/harshankur/officeParser). Slide structure (titles, bullets) is preserved.

```
filepath  — Absolute path to the .pptx file
```

### `youtube_to_markdown`

Fetches a YouTube transcript and formats it as timestamped paragraphs grouped in ~30-second chunks. Falls back to any available language if the requested one isn't found.

```
url   — Full YouTube URL or bare 11-character video ID
lang  — (optional) Language code, e.g. "en", "id". Defaults to "en"
```

Supported URL formats:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `VIDEO_ID` (bare 11-character ID)

**Proxy support:** If YouTube is blocked on your network, set `HTTPS_PROXY` (or `HTTP_PROXY`) in your environment before starting the server.

---

## Development

```bash
# Run in dev mode (no build step)
bun run dev

# Type-check
bun run typecheck

# Build
bun run build
```

---

## License

MIT
