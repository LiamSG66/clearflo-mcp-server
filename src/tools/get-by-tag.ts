import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpecLoader } from "../spec-loader.js";
import { formatEndpointDetail } from "../utils/format.js";
import { truncate } from "../utils/truncate.js";

export function registerGetByTag(
  server: McpServer,
  specLoader: SpecLoader
): void {
  server.tool(
    "clearflo_get_endpoints_by_tag",
    "Get full details for all endpoints in a specific tag/group",
    { tag: z.string().describe("Tag name (case-insensitive)") },
    async ({ tag }) => {
      try {
        const spec = specLoader.getSpec();
        const normalizedTag = tag.toLowerCase();
        const matchedTag = spec.tags.find(
          (t) => t.name.toLowerCase() === normalizedTag
        );

        if (!matchedTag) {
          const available = spec.tags.map((t) => t.name).join(", ");
          return {
            content: [
              {
                type: "text",
                text: `Tag "${tag}" not found. Available tags: ${available}`,
              },
            ],
            isError: true,
          };
        }

        const endpoints = spec.endpoints.filter((ep) =>
          ep.tags.some((t) => t.toLowerCase() === normalizedTag)
        );

        const header = `# Tag: ${matchedTag.name}\n\n${matchedTag.description || ""}\n\n**${endpoints.length} endpoints**\n\n---\n\n`;
        const details = endpoints
          .map((ep) => formatEndpointDetail(ep))
          .join("\n\n---\n\n");

        return {
          content: [{ type: "text", text: truncate(header + details) }],
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
