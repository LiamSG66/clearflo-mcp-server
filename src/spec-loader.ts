import type {
  ParsedSpec,
  ParsedEndpoint,
  ParsedTag,
  ParsedParameter,
} from "./types.js";

interface OpenAPISpec {
  info?: { title?: string; version?: string; description?: string };
  tags?: Array<{ name?: string; description?: string }>;
  paths?: Record<string, Record<string, OpenAPIOperation>>;
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<
      string,
      { schema?: Record<string, unknown> }
    >;
  };
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<
        string,
        { schema?: Record<string, unknown> }
      >;
    }
  >;
}

interface OpenAPIParameter {
  name?: string;
  in?: string;
  required?: boolean;
  description?: string;
  schema?: Record<string, unknown>;
}

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
];

export class SpecLoader {
  private spec: ParsedSpec | null = null;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async load(): Promise<void> {
    try {
      const url = `${this.baseUrl}/api/v1/openapi.json`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch spec: ${response.status} ${response.statusText}`
        );
      }

      const raw = (await response.json()) as OpenAPISpec;
      this.spec = this.parse(raw);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(`[SpecLoader] Failed to load spec: ${message}`);
      this.spec = null;
    }
  }

  async refresh(): Promise<ParsedSpec> {
    await this.load();
    return this.getSpec();
  }

  getSpec(): ParsedSpec {
    if (!this.spec) {
      throw new Error(
        "OpenAPI spec not loaded. The server may be unreachable. Use clearflo_refresh_spec to retry."
      );
    }
    return this.spec;
  }

  isLoaded(): boolean {
    return this.spec !== null;
  }

  private parse(raw: OpenAPISpec): ParsedSpec {
    const endpoints: ParsedEndpoint[] = [];

    for (const [path, methods] of Object.entries(raw.paths ?? {})) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!HTTP_METHODS.includes(method.toLowerCase())) continue;

        const op = operation as OpenAPIOperation;

        const parameters: ParsedParameter[] = (
          op.parameters ?? []
        ).map((p) => ({
          name: p.name ?? "",
          in: (p.in ?? "query") as ParsedParameter["in"],
          required: p.required ?? false,
          description: p.description ?? "",
          schema: p.schema ?? {},
        }));

        let requestBody: ParsedEndpoint["requestBody"] = null;
        if (op.requestBody?.content) {
          const contentType = Object.keys(op.requestBody.content)[0];
          if (contentType) {
            requestBody = {
              required: op.requestBody.required ?? false,
              contentType,
              schema:
                op.requestBody.content[contentType]?.schema ?? {},
            };
          }
        }

        const responses: ParsedEndpoint["responses"] = {};
        for (const [code, resp] of Object.entries(
          op.responses ?? {}
        )) {
          let schema: Record<string, unknown> | null = null;
          if (resp.content) {
            const ct = Object.keys(resp.content)[0];
            if (ct) {
              schema = resp.content[ct]?.schema ?? null;
            }
          }
          responses[code] = {
            description: resp.description ?? "",
            schema,
          };
        }

        endpoints.push({
          method: method.toUpperCase(),
          path,
          operationId: op.operationId ?? "",
          summary: op.summary ?? "",
          description: op.description ?? "",
          tags: op.tags ?? [],
          parameters,
          requestBody,
          responses,
        });
      }
    }

    // Build tags with counts
    const tagMap = new Map<string, { description: string; count: number }>();

    // Seed from spec-level tags
    for (const t of raw.tags ?? []) {
      if (t.name) {
        tagMap.set(t.name, {
          description: t.description ?? "",
          count: 0,
        });
      }
    }

    // Count endpoints per tag
    for (const ep of endpoints) {
      for (const tag of ep.tags) {
        const existing = tagMap.get(tag);
        if (existing) {
          existing.count++;
        } else {
          tagMap.set(tag, { description: "", count: 1 });
        }
      }
    }

    const tags: ParsedTag[] = Array.from(tagMap.entries()).map(
      ([name, data]) => ({
        name,
        description: data.description,
        endpointCount: data.count,
      })
    );

    return {
      title: raw.info?.title ?? "Unknown API",
      version: raw.info?.version ?? "0.0.0",
      description: raw.info?.description ?? "",
      tags,
      endpoints,
    };
  }
}
