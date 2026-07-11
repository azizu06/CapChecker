import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { describe, expect, it } from "vitest";

import { AnalysisEventSchema } from "@/domain/analysis";
import type { VideoIngestionSource } from "@/server/ingestion/video-ingestion";

import { createNodeLiveAnalysisOrchestrator } from "./node-live-analysis";

const enabled =
  process.env.CAPCHECK_LIVE_ANALYSIS === "1" &&
  Boolean(process.env.GEMINI_API_KEY) &&
  Boolean(process.env.FINNHUB_KEY) &&
  Boolean(
    process.env.CAPCHECK_LIVE_SHORT_URL ||
      process.env.CAPCHECK_LIVE_UPLOAD_PATH,
  );

const mimeTypeForPath = (path: string) => {
  if (path.toLocaleLowerCase().endsWith(".mov")) return "video/quicktime";
  if (path.toLocaleLowerCase().endsWith(".webm")) return "video/webm";
  return "video/mp4";
};

describe.skipIf(!enabled)("live analysis smoke", () => {
  it("streams one prepared video through the complete production pipeline", async () => {
    let source: VideoIngestionSource;
    const uploadPath = process.env.CAPCHECK_LIVE_UPLOAD_PATH;
    if (uploadPath) {
      source = {
        kind: "upload",
        fileName: basename(uploadPath),
        mimeType: mimeTypeForPath(uploadPath),
        bytes: new Uint8Array(await readFile(uploadPath)),
      };
    } else {
      source = {
        kind: "url",
        url: process.env.CAPCHECK_LIVE_SHORT_URL!,
      };
    }

    const stream = createNodeLiveAnalysisOrchestrator({
      geminiApiKey: process.env.GEMINI_API_KEY!,
      finnhubApiKey: process.env.FINNHUB_KEY!,
    });
    const events = [];
    for await (const event of stream(source, new AbortController().signal)) {
      events.push(AnalysisEventSchema.parse(event));
    }

    expect(
      events.flatMap((event) =>
        event.type === "progress" ? [event.stage] : [],
      ),
    ).toEqual([
      "fetching",
      "processing",
      "extracting",
      "verifying",
      "synthesizing",
    ]);
    expect(events.at(-1)?.type).toBe("complete");
  }, 10 * 60_000);
});
