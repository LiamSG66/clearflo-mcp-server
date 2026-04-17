import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpecLoader } from "../spec-loader.js";
import { formatTagTable } from "../utils/format.js";
import { truncate } from "../utils/truncate.js";

export function registerListTags(
  server: McpServer,
  specLoader: SpecLoader
): void {
  server.tool(
    "clearflo_list_tags",
    "List all API endpoint groups (tags) with descriptions and endpoint counts",
    {},
    async () => {
      try {
        const spec = specLoader.getSpec();
        const header = `# ${spec.title} v${spec.version}\n\n${spec.description}\n\n**${spec.endpoints.length} endpoints** across **${spec.tags.length} tags**\n\n`;
        const table = formatTagTable(spec.tags);
        return {
          content: [{ type: "text", text: truncate(header + table) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
