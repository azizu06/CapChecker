import type { ActiveGeminiFile } from "@/server/ingestion/video-ingestion";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_MODEL = "gemini-3.5-flash";
const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);

const extractionPrompt = `Transcribe this financial video and extract every distinct financial claim.

For each transcript segment, preserve the spoken wording and its non-negative start time in seconds.
For each claim, assign a unique sequential id such as claim-1, preserve the claim as stated and its timestamp, and classify it as factual, predictive, or opinion. Mark a claim checkable only when external evidence can verify it. Do not turn opinions into checkable claims.
When a claim contains a quantity, preserve all available ticker, metric, value, and period details in quant. Omit quant when those four details are not all present. Return only the requested JSON structure.`;

const transcriptSegmentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    timestampSeconds: { type: "number", minimum: 0 },
    text: { type: "string" },
  },
  required: ["timestampSeconds", "text"],
};

const quantSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ticker: { type: "string" },
    metric: { type: "string" },
    value: { type: "string" },
    period: { type: "string" },
  },
  required: ["ticker", "metric", "value", "period"],
};

const claimProperties = {
  id: { type: "string" },
  text: { type: "string" },
  timestampSeconds: { type: "number", minimum: 0 },
  quant: quantSchema,
};

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    transcript: {
      type: "array",
      minItems: 1,
      items: transcriptSegmentSchema,
    },
    claims: {
      type: "array",
      items: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              ...claimProperties,
              kind: { type: "string", enum: ["factual", "predictive"] },
              checkable: { type: "boolean" },
            },
            required: [
              "id",
              "text",
              "timestampSeconds",
              "kind",
              "checkable",
            ],
          },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              ...claimProperties,
              kind: { type: "string", enum: ["opinion"] },
              checkable: { type: "boolean" },
            },
            required: [
              "id",
              "text",
              "timestampSeconds",
              "kind",
              "checkable",
            ],
          },
        ],
      },
    },
  },
  required: ["transcript", "claims"],
};

type GeminiClaimGeneratorOptions = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
};

type GenerateInput = {
  file: ActiveGeminiFile;
  signal: AbortSignal;
};

type ClaimGenerationErrorDetails = {
  code: string;
  message: string;
  retryable: boolean;
};

export class ClaimGenerationError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(details: ClaimGenerationErrorDetails) {
    super(details.message);
    this.name = "ClaimGenerationError";
    this.code = details.code;
    this.retryable = details.retryable;
  }
}

const malformedClaimExtraction = () =>
  new ClaimGenerationError({
    code: "MALFORMED_CLAIM_EXTRACTION",
    message: "Gemini returned an invalid transcript or claim structure.",
    retryable: true,
  });

const requestFailure = (retryable: boolean) =>
  new ClaimGenerationError({
    code: "GEMINI_CLAIM_REQUEST_FAILED",
    message: "Gemini could not extract claims from this video. Try again.",
    retryable,
  });

const readCandidateText = (value: unknown) => {
  if (!value || typeof value !== "object") return undefined;
  const candidates = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return undefined;
  const candidate = candidates[0];
  if (!candidate || typeof candidate !== "object") return undefined;
  const content = (candidate as { content?: unknown }).content;
  if (!content || typeof content !== "object") return undefined;
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return undefined;
  const textPart = parts.find(
    (part) =>
      part &&
      typeof part === "object" &&
      typeof (part as { text?: unknown }).text === "string",
  );
  return textPart && typeof textPart === "object"
    ? (textPart as { text: string }).text
    : undefined;
};

export function createGeminiClaimGenerator({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  model = DEFAULT_MODEL,
  fetch: fetchImpl = globalThis.fetch,
  requestTimeoutMs = 120_000,
}: GeminiClaimGeneratorOptions) {
  return {
    async generate({ file, signal }: GenerateInput): Promise<unknown> {
      const timeout = new AbortController();
      const timer = setTimeout(
        () =>
          timeout.abort(new DOMException("Request timed out", "TimeoutError")),
        requestTimeoutMs,
      );

      try {
        let response: Response;
        try {
          response = await fetchImpl(
            `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey,
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        fileData: {
                          fileUri: file.uri,
                          mimeType: file.mimeType,
                        },
                      },
                      { text: extractionPrompt },
                    ],
                  },
                ],
                generationConfig: {
                  responseMimeType: "application/json",
                  responseJsonSchema,
                },
              }),
              signal: AbortSignal.any([signal, timeout.signal]),
            },
          );
        } catch (cause) {
          if (signal.aborted) throw cause;
          if (timeout.signal.aborted) {
            throw new ClaimGenerationError({
              code: "GEMINI_CLAIM_REQUEST_TIMEOUT",
              message: "Gemini took too long to extract claims. Try again.",
              retryable: true,
            });
          }
          throw requestFailure(true);
        }
        if (!response.ok) {
          throw requestFailure(transientStatuses.has(response.status));
        }
        let responsePayload: unknown;
        try {
          responsePayload = await response.json();
        } catch {
          throw malformedClaimExtraction();
        }
        const text = readCandidateText(responsePayload);
        if (!text) throw malformedClaimExtraction();
        try {
          return JSON.parse(text) as unknown;
        } catch {
          throw malformedClaimExtraction();
        }
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
