#!/usr/bin/env node
// End-to-end check of the built server under Node (the runtime npx users get).
// Fails if any stdout line is not JSON-RPC, or if a file tool returns isError.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(ROOT, "test", "fixtures");
const RESPONSE_TIMEOUT_MS = 30_000;
const PROTOCOL_VERSION = "2025-06-18";

const TOOL_CALLS = [
  { name: "pdf_to_markdown", file: "sample.pdf", expect: "Hello PDF" },
  { name: "docx_to_markdown", file: "sample.docx", expect: "Hello Doc" },
  { name: "xlsx_to_markdown", file: "sample.xlsx", expect: "Ada" },
  { name: "pptx_to_markdown", file: "sample.pptx", expect: "Slide 1" },
];

function startServer() {
  const child = spawn(process.execPath, [join(ROOT, "dist", "index.js")], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  const pending = new Map();
  const protocolErrors = [];
  let buffer = "";

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) handleLine(line, pending, protocolErrors);
    }
  });

  return { child, pending, protocolErrors };
}

function handleLine(line, pending, protocolErrors) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    protocolErrors.push(line);
    return;
  }
  if (message?.jsonrpc !== "2.0") {
    protocolErrors.push(line);
    return;
  }
  const resolve = pending.get(message.id);
  if (resolve) {
    pending.delete(message.id);
    resolve(message);
  }
}

let nextId = 1;
function request(server, method, params) {
  const id = nextId++;
  const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${method}`)),
      RESPONSE_TIMEOUT_MS
    );
    server.pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    server.child.stdin.write(payload + "\n");
  });
}

function notify(server, method) {
  server.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method }) + "\n");
}

async function runChecks(server) {
  const failures = [];
  await request(server, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "smoke", version: "1.0.0" },
  });
  notify(server, "notifications/initialized");

  const list = await request(server, "tools/list", {});
  const names = (list.result?.tools ?? []).map((t) => t.name);
  console.log(`tools/list: ${names.join(", ")}`);

  for (const call of TOOL_CALLS) {
    const res = await request(server, "tools/call", {
      name: call.name,
      arguments: { filepath: join(FIXTURES, call.file) },
    });
    const text = res.result?.content?.[0]?.text ?? "";
    const ok = !res.result?.isError && text.includes(call.expect);
    console.log(`${ok ? "PASS" : "FAIL"} ${call.name}`);
    if (!ok) failures.push(`${call.name}: ${text.slice(0, 200)}`);
  }
  return failures;
}

async function main() {
  const server = startServer();
  try {
    const failures = await runChecks(server);
    for (const line of server.protocolErrors) {
      failures.push(`non-JSON-RPC stdout line: ${line.slice(0, 200)}`);
    }
    if (failures.length > 0) {
      console.error("\nSmoke test failed:\n- " + failures.join("\n- "));
      process.exitCode = 1;
    } else {
      console.log("\nSmoke test passed.");
    }
  } finally {
    server.child.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
