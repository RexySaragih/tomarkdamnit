import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PACKAGE_VERSION } from "./shared/constants.js";
import { registerFileTools } from "./tools/file-tools.js";
import { registerYoutubeTool } from "./tools/youtube-tool.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "tomarkdamnit",
    version: PACKAGE_VERSION,
  });

  registerFileTools(server);
  registerYoutubeTool(server);

  return server;
}
