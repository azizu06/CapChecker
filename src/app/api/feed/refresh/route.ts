import { streamFixtureAnalysis } from "@/server/analysis/fixture-adapter";
import { createNodeLiveAnalysisOrchestrator } from "@/server/analysis/node-live-analysis";
import { createSupabaseRefreshCatalogPort } from "@/server/feed/refresh/catalog-port-adapter";
import { FIXTURE_CANDIDATES } from "@/server/feed/refresh/fixtures";
import { createInMemoryCatalog } from "@/server/feed/refresh/in-memory-catalog";
import { createRefreshRunner } from "@/server/feed/refresh/refresh-runner";
import { createScorecardAnalyzer } from "@/server/feed/refresh/scorecard-analyzer";
import { createYouTubeDiscovery } from "@/server/feed/refresh/youtube-discovery";

import { createRefreshHandler, type RefreshRunner } from "./route-handler";

const isFixtureMode = () =>
  process.env.CAPCHECK_ANALYSIS_MODE === "fixture" &&
  process.env.NODE_ENV !== "production";

// One process-wide runner so single-flight spans all requests.
let runner: RefreshRunner | undefined;

const buildRunner = (): RefreshRunner => {
  if (isFixtureMode()) {
    return createRefreshRunner({
      discovery: {
        async discover({ limit }) {
          return FIXTURE_CANDIDATES.slice(0, limit);
        },
      },
      analyze: createScorecardAnalyzer({
        createStream:
          () =>
          (_source, signal) =>
            streamFixtureAnalysis({ scenario: "legitimate" }, signal),
      }),
      // Fixture catalog persists for the lifetime of the server process, so a
      // second refresh sees the first accepted card and reports it as duplicate.
      catalog: createInMemoryCatalog(),
    });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const finnhubApiKey = process.env.FINNHUB_KEY;
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  if (!geminiApiKey || !finnhubApiKey || !youtubeApiKey) {
    throw new Error("Feed refresh credentials are not configured");
  }

  const streamLiveAnalysis = createNodeLiveAnalysisOrchestrator({
    geminiApiKey,
    finnhubApiKey,
  });

  return createRefreshRunner({
    discovery: createYouTubeDiscovery({ apiKey: youtubeApiKey }),
    analyze: createScorecardAnalyzer({
      createStream: () => streamLiveAnalysis,
    }),
    // TODO(lane-b integration): replace with Lane B's CatalogRepository once
    // issue #30 lands. Until then live refresh reports itself unavailable.
    catalog: createSupabaseRefreshCatalogPort({
      hasItem: async () => false,
      upsertItem: async () => ({ inserted: true }),
      startRefreshRun: async () => "",
      finishRefreshRun: async () => undefined,
    }),
  });
};

export const POST = createRefreshHandler({
  getRunner: () => {
    runner ??= buildRunner();
    return runner;
  },
});
