import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import { describe, expect, it } from "vitest";

import { createNodeVideoIngestor } from "./node-video-ingestor";

const apiKey = process.env.GEMINI_API_KEY;
const shortUrl = process.env.CAPCHECK_LIVE_SHORT_URL;
const uploadPath = process.env.CAPCHECK_LIVE_UPLOAD_PATH;
const canRunUrl = Boolean(apiKey && shortUrl);
const canRunUpload = Boolean(apiKey && uploadPath);

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

describe("live Gemini video ingestion", () => {
  it.skipIf(!canRunUrl)(
    "downloads one real short video and leases its ACTIVE Gemini file",
    async () => {
      const ingestor = createNodeVideoIngestor({ apiKey: apiKey! });

      await expect(
        ingestor.withActiveFile(
          { kind: "url", url: shortUrl! },
          { signal: new AbortController().signal, onProgress: () => undefined },
          async (file) => file,
        ),
      ).resolves.toMatchObject({
        name: expect.stringMatching(/^files\//u),
        uri: expect.stringMatching(/^https:\/\//u),
        mimeType: expect.stringMatching(/^video\//u),
      });
    },
    180_000,
  );

  it.skipIf(!canRunUpload)(
    "stages one prepared upload and leases its ACTIVE Gemini file",
    async () => {
      const bytes = await readFile(uploadPath!);
      const ingestor = createNodeVideoIngestor({ apiKey: apiKey! });

      await expect(
        ingestor.withActiveFile(
          {
            kind: "upload",
            fileName: basename(uploadPath!),
            mimeType: declaredMimeType(uploadPath!),
            bytes,
          },
          { signal: new AbortController().signal, onProgress: () => undefined },
          async (file) => file,
        ),
      ).resolves.toMatchObject({
        name: expect.stringMatching(/^files\//u),
        uri: expect.stringMatching(/^https:\/\//u),
        mimeType: expect.stringMatching(/^video\//u),
      });
    },
    180_000,
  );
});
