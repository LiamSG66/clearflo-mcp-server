import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { SpecLoader } from "./spec-loader.js";
import { registerListTags } from "./tools/list-tags.js";
import { registerGetByTag } from "./tools/get-by-tag.js";
import { registerGetDetail } from "./tools/get-detail.js";
import { registerSearch } from "./tools/search.js";
import { registerCall } from "./tools/call.js";
import { registerRefresh } from "./tools/refresh.js";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function buildServer(specLoader: SpecLoader): McpServer {
  const server = new McpServer({
    name: "clearflo-api",
    version: "1.0.0",
  });

  registerListTags(server, specLoader);
  registerGetByTag(server, specLoader);
  registerGetDetail(server, specLoader);
  registerSearch(server, specLoader);
  registerCall(server, specLoader);
  registerRefresh(server, specLoader);

  return server;
}

async function main(): Promise<void> {
  const baseUrl = process.env.CLEARFLO_API_URL ?? "https://app.clearflo.ai";
  const httpMode = process.env.MCP_HTTP_MODE === "true" || Boolean(process.env.PORT);
  const authToken = process.env.MCP_AUTH_TOKEN;

  const specLoader = new SpecLoader(baseUrl);
  await specLoader.load();

  if (specLoader.isLoaded()) {
    const spec = specLoader.getSpec();
    console.error(
      `[clearflo-api] Loaded ${spec.title} v${spec.version}: ${spec.endpoints.length} endpoints, ${spec.tags.length} tags`
    );
  } else {
    console.error(
      `[clearflo-api] Warning: Could not load spec from ${baseUrl}. Will retry on interval and via clearflo_refresh_spec.`
    );
  }

  setInterval(() => {
    specLoader.refresh().catch((err) => {
      console.error(`[clearflo-api] Auto-refresh failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }, REFRESH_INTERVAL_MS).unref();

  if (httpMode) {
    await startHttpServer(specLoader, authToken);
  } else {
    await startStdioServer(specLoader);
  }
}

async function startStdioServer(specLoader: SpecLoader): Promise<void> {
  const server = buildServer(specLoader);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function startHttpServer(specLoader: SpecLoader, authToken: string | undefined): Promise<void> {
  const port = Number(process.env.PORT ?? 8080);
  const app = express();
  app.use(express.json());

  if (authToken) {
    app.use("/mcp", (req: Request, res: Response, next: NextFunction) => {
      const header = req.header("authorization") ?? "";
      const expected = `Bearer ${authToken}`;
      if (header !== expected) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      next();
    });
  }

  app.get("/healthz", (_req: Request, res: Response) => {
    const loaded = specLoader.isLoaded();
    res.status(loaded ? 200 : 503).json({
      status: loaded ? "ok" : "spec_unavailable",
      loaded,
    });
  });

  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Compat shim: OpenClaw's MCP client (as of 2026.4.14) doesn't send the
  // spec-required `Accept: application/json, text/event-stream` header on
  // streamable-http requests. Rewrite it here so the SDK's 406 check passes.
  // Remove once OpenClaw ships a compliant client.
  app.all("/mcp", (req: Request, _res: Response, next: NextFunction) => {
    const accept = req.headers.accept ?? "";
    if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
      req.headers.accept = "application/json, text/event-stream";
    }
    next();
  });

  app.all("/mcp", async (req: Request, res: Response) => {
    try {
      const sessionId = req.header("mcp-session-id");
      let transport = sessionId ? transports.get(sessionId) : undefined;

      if (!transport) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, transport!);
          },
        });

        transport.onclose = () => {
          if (transport!.sessionId) {
            transports.delete(transport!.sessionId);
          }
        };

        const server = buildServer(specLoader);
        await server.connect(transport);
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[clearflo-api] HTTP request failed:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "internal_error" });
      }
    }
  });

  app.listen(port, () => {
    console.error(`[clearflo-api] HTTP server listening on :${port} (auth: ${authToken ? "enabled" : "disabled"})`);
  });
}

main().catch((error) => {
  console.error("[clearflo-api] Fatal error:", error);
  process.exit(1);
});
