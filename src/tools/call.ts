import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpecLoader } from "../spec-loader.js";
import { truncate } from "../utils/truncate.js";

export function registerCall(
  server: McpServer,
  specLoader: SpecLoader
): void {
  server.tool(
    "clearflo_call_endpoint",
    "Execute a live API call against the Clearflo API. Requires CLEARFLO_API_KEY env var.",
    {
      method: z
        .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
        .describe("HTTP method"),
      path: z
        .string()
        .describe("Endpoint path (e.g. /api/v1/leads)"),
      path_params: z
        .record(z.string())
        .optional()
        .describe(
          "Path parameter substitutions (e.g. { id: '123' } replaces {id} in path)"
        ),
      query_params: z
        .record(z.string())
        .optional()
        .describe("Query string parameters"),
      body: z
        .record(z.unknown())
        .optional()
        .describe("Request body (JSON)"),
    },
    async ({ method, path, path_params, query_params, body }) => {
      try {
        // Verify spec is loaded (validates the endpoint exists)
        specLoader.getSpec();

        const apiKey = process.env.CLEARFLO_API_KEY;
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "CLEARFLO_API_KEY environment variable is not set. Set it in .mcp.json env config.",
              },
            ],
            isError: true,
          };
        }

        const baseUrl = process.env.CLEARFLO_API_URL ?? "https://app.clearflo.ai";

        // Substitute path params
        let resolvedPath = path;
        if (path_params) {
          for (const [key, value] of Object.entries(path_params)) {
            resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(value));
          }
        }

        // Build URL with query params
        const url = new URL(resolvedPath, baseUrl);
        if (query_params) {
          for (const [key, value] of Object.entries(query_params)) {
            url.searchParams.set(key, value);
          }
        }

        // Build request
        const headers: Record<string, string> = {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        };

        const fetchOptions: RequestInit = {
          method,
          headers,
        };

        if (body && method !== "GET") {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url.toString(), fetchOptions);
        const responseText = await response.text();

        // Try to parse as JSON for pretty printing
        let formattedBody: string;
        try {
          const json = JSON.parse(responseText) as unknown;
          formattedBody = JSON.stringify(json, null, 2);
        } catch {
          formattedBody = responseText;
        }

        const output = `**${response.status} ${response.statusText}**\n\n\`\`\`json\n${formattedBody}\n\`\`\``;

        return {
          content: [{ type: "text", text: truncate(output) }],
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
