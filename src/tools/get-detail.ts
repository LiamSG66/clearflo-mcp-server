import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpecLoader } from "../spec-loader.js";
import { formatEndpointDetail } from "../utils/format.js";
import { truncate } from "../utils/truncate.js";

export function registerGetDetail(
  server: McpServer,
  specLoader: SpecLoader
): void {
  server.tool(
    "clearflo_get_endpoint_detail",
    "Get full detail for a specific endpoint by method and path",
    {
      method: z
        .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
        .describe("HTTP method"),
      path: z.string().describe("Endpoint path (e.g. /api/v1/leads)"),
    },
    async ({ method, path }) => {
      try {
        const spec = specLoader.getSpec();
        const endpoint = spec.endpoints.find(
          (ep) =>
            ep.method === method.toUpperCase() &&
            ep.path === path
        );

        if (!endpoint) {
          const similar = spec.endpoints
            .filter(
              (ep) =>
                ep.path.includes(path) ||
                path.includes(ep.path)
            )
            .slice(0, 5)
            .map((ep) => `${ep.method} ${ep.path}`)
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `Endpoint ${method} ${path} not found.${similar ? `\n\nSimilar endpoints:\n${similar}` : ""}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            { type: "text", text: truncate(formatEndpointDetail(endpoint)) },
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
