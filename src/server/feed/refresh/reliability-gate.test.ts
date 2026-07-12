import { describe, expect, it } from "vitest";

import type {
  Evidence,
  Scorecard,
  Verification,
} from "@/domain/analysis";

import { evaluateReliability, type ReliabilityInput } from "./reliability-gate";

const evidence = (trustTier: Evidence["trustTier"]): Evidence => ({
  id: `evidence-${trustTier}`,
  title: "Source",
  publisher: "Publisher",
  url: "https://example.gov/source",
  trustTier,
  stance: "supports",
  excerpt: "Supporting excerpt.",
});

const verification = (
  verdict: Verification["verdict"],
  trustTier: Evidence["trustTier"] = "primary",
): Verification => ({
  claim: {
    id: `claim-${verdict}`,
    text: "A checkable financial claim.",
    kind: "factual",
    checkable: true,
  },
  verdict,
  confidence: 0.9,
  explanation: "Explanation.",
  evidence: [evidence(trustTier)],
});

// Built as a plain object (not schema-parsed) so adversarial combinations that
// the ScorecardSchema would reject can still be exercised by the pure gate.
const makeScorecard = (overrides: Partial<Scorecard> = {}): Scorecard => ({
  id: "scorecard-test",
  source: { kind: "url", url: "https://www.youtube.com/watch?v=abc" },
  capScore: 12,
  capLabel: "no-cap",
  summary: "A calm, well-sourced explainer.",
  verifications: [verification("true"), verification("mostly-true")],
  hypeFindings: [],
  nextActions: [],
  generatedAt: "2026-07-11T15:00:00.000Z",
  ...overrides,
});

const baseInput = (overrides: Partial<ReliabilityInput> = {}): ReliabilityInput => ({
  scorecard: makeScorecard(),
  tldr: "A calm, well-sourced explainer.",
  category: "investing",
  analyzedAt: "2026-07-11T15:00:00.000Z",
  ...overrides,
});

describe("reliability gate", () => {
  it("accepts a fully trusted candidate", () => {
    const result = evaluateReliability(baseInput());
    expect(result).toEqual({ accepted: true, reasons: [] });
  });

  it("accepts the boundary Cap Score of 29", () => {
    expect(
      evaluateReliability(baseInput({ scorecard: makeScorecard({ capScore: 29 }) }))
        .accepted,
    ).toBe(true);
  });

  it("rejects a Cap Score of 30 or higher", () => {
    const result = evaluateReliability(
      baseInput({ scorecard: makeScorecard({ capScore: 30, capLabel: "some-cap" }) }),
    );
    expect(result.accepted).toBe(false);
    expect(result.reasons.join(" ")).toContain("Cap Score 30");
  });

  it("rejects any cap label other than no-cap", () => {
    const result = evaluateReliability(
      baseInput({ scorecard: makeScorecard({ capLabel: "some-cap" }) }),
    );
    expect(result.accepted).toBe(false);
    expect(result.reasons.join(" ")).toContain("not \"no-cap\"");
  });

  it("rejects any false verdict", () => {
    const result = evaluateReliability(
      baseInput({
        scorecard: makeScorecard({
          verifications: [verification("true"), verification("false")],
        }),
      }),
    );
    expect(result.accepted).toBe(false);
    expect(result.reasons.join(" ")).toContain("verified as false");
  });

  it("allows exactly one unverifiable verdict", () => {
    const result = evaluateReliability(
      baseInput({
        scorecard: makeScorecard({
          verifications: [verification("true"), verification("unverifiable")],
        }),
      }),
    );
    expect(result.accepted).toBe(true);
  });

  it("rejects more than one unverifiable verdict", () => {
    const result = evaluateReliability(
      baseInput({
        scorecard: makeScorecard({
          verifications: [
            verification("unverifiable"),
            verification("unverifiable"),
          ],
        }),
      }),
    );
    expect(result.accepted).toBe(false);
    expect(result.reasons.join(" ")).toContain("unverifiable");
  });

  it("rejects when no primary or high-trust citation is present", () => {
    const result = evaluateReliability(
      baseInput({
        scorecard: makeScorecard({
          verifications: [
            verification("true", "medium"),
            verification("mostly-true", "low"),
          ],
        }),
      }),
    );
    expect(result.accepted).toBe(false);
    expect(result.reasons.join(" ")).toContain("high-trust citation");
  });

  it("accepts when at least one high-trust citation exists among weaker ones", () => {
    const result = evaluateReliability(
      baseInput({
        scorecard: makeScorecard({
          verifications: [
            verification("true", "medium"),
            verification("mostly-true", "high"),
          ],
        }),
      }),
    );
    expect(result.accepted).toBe(true);
  });

  it("rejects a missing TLDR", () => {
    const result = evaluateReliability(baseInput({ tldr: "   " }));
    expect(result.accepted).toBe(false);
    expect(result.reasons.join(" ")).toContain("TLDR is missing");
  });

  it("rejects a missing category", () => {
    const result = evaluateReliability(baseInput({ category: null }));
    expect(result.accepted).toBe(false);
    expect(result.reasons.join(" ")).toContain("finance category");
  });

  it("rejects a missing or invalid analysis timestamp", () => {
    expect(evaluateReliability(baseInput({ analyzedAt: "" })).accepted).toBe(false);
    expect(
      evaluateReliability(baseInput({ analyzedAt: "not-a-date" })).accepted,
    ).toBe(false);
  });

  it("collects every failing reason at once", () => {
    const result = evaluateReliability(
      baseInput({
        scorecard: makeScorecard({
          capScore: 80,
          capLabel: "full-of-cap",
          verifications: [verification("false", "low")],
        }),
        tldr: "",
        category: null,
        analyzedAt: "",
      }),
    );
    expect(result.accepted).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(6);
  });
});
