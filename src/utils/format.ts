import type { ParsedEndpoint, ParsedTag } from "../types.js";

export function formatTagTable(tags: ParsedTag[]): string {
  const lines = [
    "| Tag | Description | Endpoints |",
    "|-----|-------------|-----------|",
  ];
  for (const tag of tags) {
    lines.push(
      `| ${tag.name} | ${tag.description || "-"} | ${tag.endpointCount} |`
    );
  }
  return lines.join("\n");
}

export function formatEndpointSummary(ep: ParsedEndpoint): string {
  return `**${ep.method} ${ep.path}** - ${ep.summary || ep.operationId || "(no summary)"}`;
}

export function formatEndpointDetail(ep: ParsedEndpoint): string {
  const sections: string[] = [];

  sections.push(`## ${ep.method} ${ep.path}`);

  if (ep.summary) sections.push(`**Summary:** ${ep.summary}`);
  if (ep.description) sections.push(`**Description:** ${ep.description}`);
  if (ep.operationId) sections.push(`**Operation ID:** ${ep.operationId}`);
  if (ep.tags.length > 0)
    sections.push(`**Tags:** ${ep.tags.join(", ")}`);

  // Parameters
  if (ep.parameters.length > 0) {
    sections.push("\n### Parameters\n");
    sections.push("| Name | In | Required | Description | Type |");
    sections.push("|------|----|----------|-------------|------|");
    for (const p of ep.parameters) {
      const type = schemaToType(p.schema);
      sections.push(
        `| ${p.name} | ${p.in} | ${p.required ? "Yes" : "No"} | ${p.description || "-"} | ${type} |`
      );
    }
  }

  // Request body
  if (ep.requestBody) {
    sections.push("\n### Request Body\n");
    sections.push(
      `**Content-Type:** ${ep.requestBody.contentType}  `
    );
    sections.push(
      `**Required:** ${ep.requestBody.required ? "Yes" : "No"}`
    );
    sections.push("\n```json");
    sections.push(JSON.stringify(ep.requestBody.schema, null, 2));
    sections.push("```");
  }

  // Responses
  const responseCodes = Object.keys(ep.responses);
  if (responseCodes.length > 0) {
    sections.push("\n### Responses\n");
    for (const code of responseCodes) {
      const resp = ep.responses[code];
      if (!resp) continue;
      sections.push(`**${code}:** ${resp.description}`);
      if (resp.schema) {
        sections.push("\n```json");
        sections.push(JSON.stringify(resp.schema, null, 2));
        sections.push("```");
      }
    }
  }

  return sections.join("\n");
}

function schemaToType(schema: Record<string, unknown>): string {
  if (!schema || Object.keys(schema).length === 0) return "unknown";

  const type = schema.type as string | undefined;
  const format = schema.format as string | undefined;

  if (type === "array") {
    const items = schema.items as Record<string, unknown> | undefined;
    return `array<${items ? schemaToType(items) : "unknown"}>`;
  }

  if (format) return `${type}(${format})`;
  return type ?? "unknown";
}
