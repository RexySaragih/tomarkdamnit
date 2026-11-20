#!/usr/bin/env node

// Must be the first import: ESM evaluates imports in order, so the console is
// redirected before any converter library loads.
import "./shared/stdout-guard.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  const transport = new StdioServerTransport();
  const server = createServer();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
