import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpecLoader } from "../spec-loader.js";
import { formatEndpointSummary, formatEndpointDetail } from "../utils/format.js";
import { truncate } from "../utils/truncate.js";

export function registerSearch(
  server: McpServer,
  specLoader: SpecLoader
): void {
  server.tool(
    "clearflo_search_endpoints",
    "Search endpoints by keyword across path, summary, description, operationId, and tags",
    {
      query: z
        .string()
        .describe("Search keyword (case-insensitive)"),
    },
    async ({ query }) => {
      try {
        const spec = specLoader.getSpec();
        const q = query.toLowerCase();

        const matches = spec.endpoints.filter((ep) => {
          const searchable = [
            ep.path,
            ep.summary,
            ep.description,
            ep.operationId,
            ...ep.tags,
          ]
            .join(" ")
            .toLowerCase();
          return searchable.includes(q);
        });

        if (matches.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No endpoints found matching "${query}".`,
              },
            ],
          };
        }

        // If 5 or fewer matches, show full details. Otherwise show summaries.
        if (matches.length <= 5) {
          const details = matches
            .map((ep) => formatEndpointDetail(ep))
            .join("\n\n---\n\n");
          const header = `# Search: "${query}" (${matches.length} results)\n\n---\n\n`;
          return {
            content: [{ type: "text", text: truncate(header + details) }],
          };
        }

        const summaries = matches
          .map((ep) => `- ${formatEndpointSummary(ep)}`)
          .join("\n");
        const header = `# Search: "${query}" (${matches.length} results)\n\nUse \`clearflo_get_endpoint_detail\` for full details on a specific endpoint.\n\n`;

        return {
          content: [{ type: "text", text: truncate(header + summaries) }],
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
