import { format } from "node:util";

/**
 * Stdout carries MCP JSON-RPC frames. Any library that logs via console.log
 * (pdf.js does) would corrupt the stream, so route console output to stderr.
 */
export function redirectConsoleToStderr(): void {
  const toStderr = (...args: unknown[]): void => {
    process.stderr.write(format(...args) + "\n");
  };
  console.log = toStderr;
  console.info = toStderr;
  console.warn = toStderr;
  console.debug = toStderr;
}

redirectConsoleToStderr();
