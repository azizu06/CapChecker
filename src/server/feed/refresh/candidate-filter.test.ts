import { describe, expect, it } from "vitest";

import {
  MAX_DURATION_SECONDS,
  deriveTldr,
  mapCategory,
  screenCandidate,
} from "./candidate-filter";
import type { DiscoveredVideo } from "./ports";

const candidate = (overrides: Partial<DiscoveredVideo> = {}): DiscoveredVideo => ({
  youtubeVideoId: "vid-1",
  url: "https://www.youtube.com/watch?v=vid-1",
  title: "Index funds explained",
  description: "How to invest in an ETF for the long term.",
  channelTitle: "Plain Finance",
  thumbnailUrl: "https://i.ytimg.com/vi/vid-1/hqdefault.jpg",
  durationSeconds: 200,
  embeddable: true,
  privacyStatus: "public",
  uploadStatus: "processed",
  ageRestricted: false,
  ...overrides,
});

describe("mapCategory", () => {
  it.each([
    ["How to build a 401k for retirement", "retirement"],
    ["Roth IRA basics", "retirement"],
    ["Tax deductions you are missing", "taxes"],
    ["Improve your credit score fast", "credit"],
    ["Index funds vs individual stocks", "investing"],
    ["How I budget my paycheck", "budgeting"],
  ])("maps %s to %s", (text, expected) => {
    expect(mapCategory(text)).toBe(expected);
  });

  it("returns null when nothing finance-related matches", () => {
    expect(mapCategory("My cat plays the piano")).toBeNull();
  });

  it("prefers the more specific bucket when several could match", () => {
    // Mentions both retirement and investing keywords; retirement wins.
    expect(mapCategory("Investing inside your roth ira")).toBe("retirement");
  });
});

describe("deriveTldr", () => {
  it("keeps short summaries intact", () => {
    expect(deriveTldr("  A calm explainer. ")).toBe("A calm explainer.");
  });

  it("truncates long summaries on a word boundary with an ellipsis", () => {
    const long = `${"word ".repeat(80)}end`;
    const tldr = deriveTldr(long);
    expect(tldr.length).toBeLessThanOrEqual(201);
    expect(tldr.endsWith("…")).toBe(true);
    expect(tldr).not.toContain("  ");
  });
});

describe("screenCandidate", () => {
  it("accepts a short, embeddable, public finance video", () => {
    const result = screenCandidate(candidate());
    expect(result).toEqual({ ok: true, category: "investing" });
  });

  it("rejects videos longer than 8 minutes", () => {
    const result = screenCandidate(
      candidate({ durationSeconds: MAX_DURATION_SECONDS + 1 }),
    );
    expect(result).toEqual({ ok: false, reason: "Longer than 8 minutes" });
  });

  it("rejects zero or unknown duration", () => {
    expect(screenCandidate(candidate({ durationSeconds: 0 })).ok).toBe(false);
  });

  it("rejects non-embeddable videos", () => {
    expect(screenCandidate(candidate({ embeddable: false })).ok).toBe(false);
  });

  it("rejects non-public videos", () => {
    expect(screenCandidate(candidate({ privacyStatus: "unlisted" })).ok).toBe(false);
  });

  it("rejects unprocessed uploads", () => {
    expect(screenCandidate(candidate({ uploadStatus: "uploaded" })).ok).toBe(false);
  });

  it("rejects age-restricted videos", () => {
    expect(screenCandidate(candidate({ ageRestricted: true })).ok).toBe(false);
  });

  it("rejects videos with no supported finance category", () => {
    const result = screenCandidate(
      candidate({ title: "Funny cat compilation", description: "cats" }),
    );
    expect(result).toEqual({ ok: false, reason: "No supported finance category" });
  });
});
