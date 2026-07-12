import { describe, expect, it } from "vitest";

import { isPortfolioDemoMode } from "./portfolio-mode";

describe("isPortfolioDemoMode", () => {
  it("turns production into a read-only showcase when live credentials are retired", () => {
    expect(isPortfolioDemoMode({ NODE_ENV: "production" })).toBe(true);
    expect(
      isPortfolioDemoMode({
        NODE_ENV: "production",
        GEMINI_API_KEY: "configured",
        FINNHUB_KEY: "configured",
      }),
    ).toBe(false);
  });

  it("keeps local fixture development interactive", () => {
    expect(isPortfolioDemoMode({ NODE_ENV: "development" })).toBe(false);
  });
});
