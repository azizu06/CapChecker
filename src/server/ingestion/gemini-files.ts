import { Blob as NodeBlob } from "node:buffer";
import { readFile as nodeReadFile } from "node:fs/promises";

import { BoundaryError } from "./video-ingestion";
import type {
  GeminiFile,
  SupportedVideoMimeType,
  VideoIngestionDependencies,
} from "./video-ingestion";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";

type ReadFile = (
  path: string,
  options: { signal: AbortSignal },
) => Promise<Buffer>;

type GeminiFilesClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  readFile?: ReadFile;
  requestTimeoutMs?: number;
};

const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);

const requestError = (status: number) =>
  new BoundaryError(
    "Gemini Files request failed",
    transientStatuses.has(status),
  );

const fileEndpoint = (baseUrl: string, name: string) => {
  if (!/^files\/[A-Za-z0-9_-]+$/.test(name)) {
    throw new BoundaryError("Gemini Files returned invalid data", false);
  }
  return `${baseUrl}/v1beta/${name}`;
};

const parseFile = (value: unknown): GeminiFile => {
  if (!value || typeof value !== "object") {
    throw new BoundaryError("Gemini Files returned invalid data", false);
  }
  const candidate = value as Record<string, unknown>;
  const states = new Set([
    "STATE_UNSPECIFIED",
    "PROCESSING",
    "ACTIVE",
    "FAILED",
  ]);
  if (
    candidate.state !== undefined &&
    (typeof candidate.state !== "string" || !states.has(candidate.state))
  ) {
    throw new BoundaryError("Gemini Files returned invalid data", false);
  }

  return {
    name: typeof candidate.name === "string" ? candidate.name : undefined,
    uri: typeof candidate.uri === "string" ? candidate.uri : undefined,
    mimeType:
      candidate.mimeType === "video/mp4" ||
      candidate.mimeType === "video/quicktime" ||
      candidate.mimeType === "video/webm"
        ? candidate.mimeType
        : undefined,
    state: (candidate.state ?? "STATE_UNSPECIFIED") as GeminiFile["state"],
  };
};

export function createGeminiFilesClient({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  fetch: fetchImpl = globalThis.fetch,
  readFile = nodeReadFile as ReadFile,
  requestTimeoutMs = 30_000,
}: GeminiFilesClientOptions): VideoIngestionDependencies["geminiFiles"] {
  const apiHeaders = { "X-Goog-Api-Key": apiKey };
  const request = async (
    input: string,
    init: RequestInit,
    callerSignal: AbortSignal,
  ) => {
    const timeout = new AbortController();
    const timer = setTimeout(
      () =>
        timeout.abort(new DOMException("Request timed out", "TimeoutError")),
      requestTimeoutMs,
    );

    try {
      return await fetchImpl(input, {
        ...init,
        signal: AbortSignal.any([callerSignal, timeout.signal]),
      });
    } catch (cause) {
      if (callerSignal.aborted) throw cause;
      if (timeout.signal.aborted) {
        throw new BoundaryError("Gemini Files request timed out", true);
      }
      throw new BoundaryError("Gemini Files request failed", true);
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async upload({ path, displayName, mimeType, signal }) {
      const bytes = await readFile(path, { signal });
      const start = await request(
        `${baseUrl}/upload/v1beta/files`,
        {
          method: "POST",
          headers: {
            ...apiHeaders,
            "Content-Type": "application/json",
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
            "X-Goog-Upload-Header-Content-Type": mimeType,
          },
          body: JSON.stringify({ file: { display_name: displayName } }),
        },
        signal,
      );
      if (!start.ok) throw requestError(start.status);

      const uploadUrl = start.headers.get("x-goog-upload-url");
      if (!uploadUrl) {
        throw new BoundaryError("Gemini Files returned invalid data", false);
      }
      const finalized = await request(
        uploadUrl,
        {
          method: "POST",
          headers: {
            "Content-Length": String(bytes.byteLength),
            "Content-Type": mimeType satisfies SupportedVideoMimeType,
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize",
          },
          body: new NodeBlob([Uint8Array.from(bytes)], {
            type: mimeType,
          }) as unknown as BodyInit,
        },
        signal,
      );
      if (!finalized.ok) throw requestError(finalized.status);

      const payload = (await finalized.json()) as { file?: unknown };
      return parseFile(payload.file);
    },
    async get(name, signal) {
      const response = await request(
        fileEndpoint(baseUrl, name),
        { method: "GET", headers: apiHeaders },
        signal,
      );
      if (!response.ok) throw requestError(response.status);
      return parseFile(await response.json());
    },
    async delete(name, signal) {
      const response = await request(
        fileEndpoint(baseUrl, name),
        { method: "DELETE", headers: apiHeaders },
        signal,
      );
      if (!response.ok) throw requestError(response.status);
    },
  };
}
