import { streamFixtureAnalysis } from "@/server/analysis/fixture-adapter";
import { createNodeLiveAnalysisOrchestrator } from "@/server/analysis/node-live-analysis";
import { getCatalogRepository } from "@/server/feed/catalog-repository";
import { createSupabaseRefreshCatalogPort } from "@/server/feed/refresh/catalog-port-adapter";
import { FIXTURE_CANDIDATES } from "@/server/feed/refresh/fixtures";
import { createRefreshRunner } from "@/server/feed/refresh/refresh-runner";
import { createScorecardAnalyzer } from "@/server/feed/refresh/scorecard-analyzer";
import { createYouTubeDiscovery } from "@/server/feed/refresh/youtube-discovery";

import { createRefreshHandler, type RefreshRunner } from "./route-handler";

const isFixtureMode = () =>
  process.env.CAPCHECK_ANALYSIS_MODE === "fixture" &&
  process.env.NODE_ENV !== "production";

// One process-wide runner so single-flight spans all requests.
let runnerPromise: Promise<RefreshRunner> | undefined;

const buildRunner = async (): Promise<RefreshRunner> => {
  const catalog = createSupabaseRefreshCatalogPort(await getCatalogRepository());
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
      catalog,
    });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const finnhubApiKey = process.env.FINNHUB_KEY;
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !geminiApiKey ||
    !finnhubApiKey ||
    !youtubeApiKey ||
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseServiceRoleKey
  ) {
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
    catalog,
  });
};

export const POST = createRefreshHandler({
  getRunner: () => {
    runnerPromise ??= buildRunner().catch((error) => {
      runnerPromise = undefined;
      throw error;
    });
    return runnerPromise;
  },
});
