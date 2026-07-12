import type { Scorecard } from "@/domain/analysis";

import type { FinanceCategory } from "./ports";

/**
 * The frozen correctness core. A candidate is only allowed into the vetted
 * feed when EVERY rule below passes. This is a pure function of its input so
 * it can be exhaustively unit-tested. Keep it deterministic and side-effect
 * free — the refresh runner depends on it never mutating the scorecard.
 */

const MAX_CAP_SCORE = 29;
const MAX_UNVERIFIABLE = 1;
const HIGH_TRUST_TIERS = new Set(["primary", "high"]);

export type ReliabilityInput = {
  scorecard: Scorecard;
  tldr: string;
  category: FinanceCategory | null;
  analyzedAt: string;
};

export type ReliabilityResult = {
  accepted: boolean;
  /** Human-readable reasons a candidate was rejected. Empty when accepted. */
  reasons: string[];
};

const isNonEmpty = (value: string) => value.trim().length > 0;

const isIsoTimestamp = (value: string) => {
  if (!isNonEmpty(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time);
};

export function evaluateReliability(input: ReliabilityInput): ReliabilityResult {
  const { scorecard, tldr, category, analyzedAt } = input;
  const reasons: string[] = [];

  if (scorecard.capScore < 0 || scorecard.capScore > MAX_CAP_SCORE) {
    reasons.push(
      `Cap Score ${scorecard.capScore} is outside the 0-${MAX_CAP_SCORE} trusted range`,
    );
  }

  if (scorecard.capLabel !== "no-cap") {
    reasons.push(`Cap label "${scorecard.capLabel}" is not "no-cap"`);
  }

  const falseCount = scorecard.verifications.filter(
    (verification) => verification.verdict === "false",
  ).length;
  if (falseCount > 0) {
    reasons.push(`${falseCount} claim(s) verified as false`);
  }

  const unverifiableCount = scorecard.verifications.filter(
    (verification) => verification.verdict === "unverifiable",
  ).length;
  if (unverifiableCount > MAX_UNVERIFIABLE) {
    reasons.push(
      `${unverifiableCount} unverifiable claim(s) exceeds the limit of ${MAX_UNVERIFIABLE}`,
    );
  }

  const hasHighTrustCitation = scorecard.verifications.some((verification) =>
    verification.evidence.some((evidence) =>
      HIGH_TRUST_TIERS.has(evidence.trustTier),
    ),
  );
  if (!hasHighTrustCitation) {
    reasons.push("No primary or high-trust citation is present");
  }

  if (!isNonEmpty(tldr)) {
    reasons.push("TLDR is missing");
  }

  if (category === null) {
    reasons.push("No supported finance category could be assigned");
  }

  if (!isIsoTimestamp(analyzedAt)) {
    reasons.push("Analysis timestamp is missing or invalid");
  }

  return { accepted: reasons.length === 0, reasons };
}
