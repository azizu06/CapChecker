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
      const deletedFiles: string[] = [];
      const observingFetch: typeof fetch = async (input, init) => {
        if (init?.method === "DELETE") deletedFiles.push(String(input));
        return globalThis.fetch(input, init);
      };
      const pipeline = createNodeClaimExtractionPipeline({
        apiKey: apiKey!,
        fetch: observingFetch,
      });
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
      const claimsWithNumbers = result.claims.filter((claim) =>
        /(?:[$€£]\s?\d|\d+(?:[.,]\d+)?\s?%|\b\d[\d,.]*\b)/u.test(
          claim.text,
        ),
      );
      expect(claimsWithNumbers.length).toBeGreaterThan(0);
      for (const claim of claimsWithNumbers) {
        expect(claim.quant).toBeDefined();
        expect(
          Object.values(claim.quant ?? {}).some((value) => value.length > 0),
        ).toBe(true);
      }
      expect(deletedFiles).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/[A-Za-z0-9_-]+$/u,
          ),
        ]),
      );
    },
    360_000,
  );
});
