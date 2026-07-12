import { describe, expect, it } from "vitest";

import { createNodeLiveAnalysisOrchestrator } from "@/server/analysis/node-live-analysis";

import type { RefreshEvent } from "./events";
import { createInMemoryCatalog } from "./in-memory-catalog";
import { createRefreshRunner } from "./refresh-runner";
import { createScorecardAnalyzer } from "./scorecard-analyzer";
import { createYouTubeDiscovery } from "./youtube-discovery";

/**
 * Opt-in live smoke test. Requires real credentials and is never part of CI.
 * Run with:
 *
 *   CAPCHECK_LIVE_REFRESH=1 \
 *   YOUTUBE_API_KEY=... GEMINI_API_KEY=... FINNHUB_KEY=... \
 *   npm run test:unit -- src/server/feed/refresh/refresh.live.test.ts
 *
 * It performs one real discovery + analysis pass against an in-memory catalog
 * and records the resulting counts. Acceptance is not asserted (real candidates
 * vary); it proves the wiring runs end to end without leaking errors.
 */
const liveEnabled =
  process.env.CAPCHECK_LIVE_REFRESH === "1" &&
  Boolean(process.env.YOUTUBE_API_KEY) &&
  Boolean(process.env.GEMINI_API_KEY) &&
  Boolean(process.env.FINNHUB_KEY);

describe.skipIf(!liveEnabled)("live feed refresh", () => {
  it(
    "runs one real discovery + analysis pass end to end",
    async () => {
      const runner = createRefreshRunner({
        discovery: createYouTubeDiscovery({
          apiKey: process.env.YOUTUBE_API_KEY!,
          now: () => 0,
        }),
        analyze: createScorecardAnalyzer({
          createStream: () =>
            createNodeLiveAnalysisOrchestrator({
              geminiApiKey: process.env.GEMINI_API_KEY!,
              finnhubApiKey: process.env.FINNHUB_KEY!,
            }),
        }),
        catalog: createInMemoryCatalog(),
        candidateLimit: 1,
      });

      const events: RefreshEvent[] = [];
      for await (const event of runner.run(new AbortController().signal)) {
        events.push(event);
      }

      console.log("live refresh evidence:", JSON.stringify(events, null, 2));
      expect(events.some((event) => event.type === "error")).toBe(false);
      const terminal = events.at(-1);
      expect(terminal).toMatchObject({
        type: "complete",
        status: "completed",
        counts: {
          discovered: 1,
          analyzed: 1,
        },
      });
      if (terminal?.type === "complete") {
        const { discovered, analyzed, kept, rejected, duplicate } = terminal.counts;
        expect(discovered).toBeLessThanOrEqual(1);
        expect(analyzed).toBeLessThanOrEqual(discovered);
        expect(kept + rejected + duplicate).toBeLessThanOrEqual(discovered);
      }
    },
    180_000,
  );
});
