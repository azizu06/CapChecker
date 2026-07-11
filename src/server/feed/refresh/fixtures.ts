import type { DiscoveredVideo } from "./ports";

/**
 * Deterministic discovery candidates for fixture mode and E2E. The first
 * candidate is screen-worthy (short, embeddable, public, maps to "investing")
 * and, paired with the fixture "legitimate" scorecard, clears the reliability
 * gate — so a fixture refresh reliably ends with one accepted video.
 */
export const FIXTURE_CANDIDATES: DiscoveredVideo[] = [
  {
    youtubeVideoId: "capcheck-fixture-index-funds",
    url: "https://www.youtube.com/watch?v=capcheck-fixture-index-funds",
    title: "Index funds explained for beginners",
    description:
      "A calm walkthrough of how index funds and ETFs let you invest in the whole market at low cost.",
    channelTitle: "Plain Finance",
    thumbnailUrl:
      "https://i.ytimg.com/vi/capcheck-fixture-index-funds/hqdefault.jpg",
    durationSeconds: 240,
    embeddable: true,
    privacyStatus: "public",
    uploadStatus: "processed",
    ageRestricted: false,
  },
];
