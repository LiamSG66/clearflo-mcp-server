export interface ParsedParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  description: string;
  schema: Record<string, unknown>;
}

export interface ParsedEndpoint {
  method: string;
  path: string;
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: ParsedParameter[];
  requestBody: {
    required: boolean;
    contentType: string;
    schema: Record<string, unknown>;
  } | null;
  responses: Record<
    string,
    {
      description: string;
      schema: Record<string, unknown> | null;
    }
  >;
}

export interface ParsedTag {
  name: string;
  description: string;
  endpointCount: number;
}

export interface ParsedSpec {
  title: string;
  version: string;
  description: string;
  tags: ParsedTag[];
  endpoints: ParsedEndpoint[];
}
