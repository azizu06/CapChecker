import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import { describe, expect, it } from "vitest";

import { createNodeClaimExtractionPipeline } from "./node-claim-extraction-pipeline";

const apiKey = process.env.GEMINI_API_KEY;
const shortUrl = process.env.CAPCHECK_LIVE_SHORT_URL;
const uploadPath = process.env.CAPCHECK_LIVE_UPLOAD_PATH;
const canRun = Boolean(apiKey && (uploadPath || shortUrl));

const declaredMimeType = (path: string) => {
  switch (extname(path).toLowerCase()) {
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
};

describe("live Gemini claim extraction", () => {
  it.skipIf(!canRun)(
    "extracts useful transcript claims from one prepared financial video",
    async () => {
      const pipeline = createNodeClaimExtractionPipeline({ apiKey: apiKey! });
      const source = uploadPath
        ? {
            kind: "upload" as const,
            fileName: basename(uploadPath),
            mimeType: declaredMimeType(uploadPath),
            bytes: new Uint8Array(await readFile(uploadPath)),
          }
        : { kind: "url" as const, url: shortUrl! };

      const result = await pipeline.extract(source, {
        signal: new AbortController().signal,
        onProgress: () => undefined,
      });

      expect(result.transcript.length).toBeGreaterThan(0);
      expect(result.claims.length).toBeGreaterThan(0);
      expect(result.claims).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.any(String),
            timestampSeconds: expect.any(Number),
            kind: expect.stringMatching(/^(factual|predictive|opinion)$/u),
            checkable: expect.any(Boolean),
          }),
        ]),
      );
      expect(result.claims.some((claim) => claim.checkable)).toBe(true);
    },
    360_000,
  );
});
