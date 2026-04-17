import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpecLoader } from "../spec-loader.js";

export function registerRefresh(
  server: McpServer,
  specLoader: SpecLoader
): void {
  server.tool(
    "clearflo_refresh_spec",
    "Re-fetch the OpenAPI spec from the server. Use after deploying new endpoints.",
    {},
    async () => {
      try {
        const spec = await specLoader.refresh();
        return {
          content: [
            {
              type: "text",
              text: `Spec refreshed. ${spec.title} v${spec.version}: ${spec.endpoints.length} endpoints across ${spec.tags.length} tags.`,
            },
          ],
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
