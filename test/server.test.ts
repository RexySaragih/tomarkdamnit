import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.ts";

const fixtures = join(import.meta.dir, "fixtures");
const FILE_TOOLS = [
  "pdf_to_markdown",
  "docx_to_markdown",
  "xlsx_to_markdown",
  "pptx_to_markdown",
];

describe("createServer", () => {
  let client: Client;

  beforeEach(async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await createServer().connect(serverTransport);
    client = new Client({ name: "test", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
  });

  test("lists all tools with titles and required inputs", async () => {
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((t) => [t.name, t]));

    expect([...byName.keys()].sort()).toEqual(
      [...FILE_TOOLS, "youtube_to_markdown"].sort()
    );
    for (const name of FILE_TOOLS) {
      expect(byName.get(name)?.title).toBeTruthy();
      expect(byName.get(name)?.inputSchema.required).toEqual(["filepath"]);
    }
    expect(byName.get("youtube_to_markdown")?.inputSchema.required).toEqual([
      "url",
    ]);
  });

  test("marks file tools read-only and closed-world, YouTube open-world", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
      const expectedOpenWorld = tool.name === "youtube_to_markdown";
      expect(tool.annotations?.openWorldHint).toBe(expectedOpenWorld);
    }
  });

  test("returns converter errors as isError results", async () => {
    const result = await client.callTool({
      name: "pdf_to_markdown",
      arguments: { filepath: "relative.pdf" },
    });
    expect(result.isError).toBe(true);
  });

  test("converts a fixture end to end", async () => {
    const result = await client.callTool({
      name: "xlsx_to_markdown",
      arguments: { filepath: join(fixtures, "sample.xlsx") },
    });
    expect(JSON.stringify(result.content)).toContain("Ada");
  });
});
