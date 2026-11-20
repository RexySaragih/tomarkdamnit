import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DEBUG_ENV } from "../shared/constants.js";
import { envFlag } from "../shared/env.js";
import { toToolError } from "../shared/errors.js";
import { truncateMarkdown } from "../shared/markdown.js";
import { getToolSemaphore } from "../shared/semaphore.js";

/** Runs a converter under the shared concurrency limit; never throws. */
export async function runTool(
  work: () => Promise<string>
): Promise<CallToolResult> {
  const release = await getToolSemaphore().acquire();
  try {
    const markdown = truncateMarkdown(await work());
    return { content: [{ type: "text", text: markdown }] };
  } catch (error: unknown) {
    if (envFlag(DEBUG_ENV)) {
      console.error("[tomarkdamnit]", error);
    }
    return toToolError(error);
  } finally {
    release();
  }
}
