import { FINANCE_CATEGORIES, type DiscoveredVideo, type FinanceCategory } from "./ports";

/** Maximum accepted candidate length: short-form finance content only. */
export const MAX_DURATION_SECONDS = 8 * 60;

const TLDR_MAX_CHARS = 200;

/**
 * Keyword sets for mapping a title/description onto one of the five supported
 * finance categories. Order matters: the first category with a keyword hit
 * wins, so more specific buckets (retirement, taxes, credit) sit ahead of the
 * broad "investing"/"budgeting" buckets.
 */
const CATEGORY_KEYWORDS: ReadonlyArray<readonly [FinanceCategory, readonly string[]]> = [
  [
    "retirement",
    ["retire", "retirement", "401k", "401(k)", "roth", " ira", "pension", "social security"],
  ],
  [
    "taxes",
    ["tax", "irs", "deduction", "w-2", "w2", "1099", "refund", "filing", "write-off"],
  ],
  [
    "credit",
    [
      "credit score",
      "credit card",
      "credit report",
      "fico",
      "debt",
      "loan",
      "apr",
      "interest rate",
      "borrow",
      "mortgage",
    ],
  ],
  [
    "investing",
    [
      "invest",
      "stock",
      "etf",
      "index fund",
      "portfolio",
      "dividend",
      "brokerage",
      "shares",
      "bond",
      "crypto",
      "s&p",
      "market",
      "compound",
    ],
  ],
  [
    "budgeting",
    [
      "budget",
      "save money",
      "saving",
      "savings",
      "spending",
      "expense",
      "emergency fund",
      "frugal",
      "cash flow",
      "paycheck",
    ],
  ],
];

/**
 * Map free text (title + description) onto a finance category, or null when
 * nothing matches. Deterministic and case-insensitive.
 */
export const mapCategory = (text: string): FinanceCategory | null => {
  const haystack = ` ${text.toLowerCase()} `;
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) return category;
  }
  return null;
};

/** Trim a scorecard summary into a card-sized TLDR (~200 chars, word-safe). */
export const deriveTldr = (summary: string): string => {
  const collapsed = summary.replace(/\s+/g, " ").trim();
  if (collapsed.length <= TLDR_MAX_CHARS) return collapsed;
  const clipped = collapsed.slice(0, TLDR_MAX_CHARS);
  const lastSpace = clipped.lastIndexOf(" ");
  const base = lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped;
  return `${base.replace(/[.,;:!?-]+$/, "")}…`;
};

export type CandidateRejection = {
  youtubeVideoId: string;
  reason: string;
};

export type PreparedCandidate = {
  video: DiscoveredVideo;
  category: FinanceCategory;
};

const isSafeDisplayText = (value: string): boolean =>
  value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Metadata-only pre-filter applied before analysis: duration, embeddability,
 * public/processed status, age-restriction, and finance-category mapping. This
 * is intentionally cheap so we spend the expensive analyzer only on plausible
 * candidates. Duplication is checked separately (needs the async catalog port).
 */
export const screenCandidate = (
  video: DiscoveredVideo,
):
  | { ok: true; category: FinanceCategory }
  | { ok: false; reason: string } => {
  if (!Number.isFinite(video.durationSeconds) || video.durationSeconds <= 0) {
    return { ok: false, reason: "Unknown or zero duration" };
  }
  if (video.durationSeconds > MAX_DURATION_SECONDS) {
    return { ok: false, reason: "Longer than 8 minutes" };
  }
  if (!video.embeddable) {
    return { ok: false, reason: "Not embeddable" };
  }
  if (video.privacyStatus !== "public") {
    return { ok: false, reason: "Not public" };
  }
  if (video.uploadStatus !== "processed") {
    return { ok: false, reason: "Upload not fully processed" };
  }
  if (video.ageRestricted) {
    return { ok: false, reason: "Age restricted" };
  }
  if (!isSafeDisplayText(video.title) || !isSafeDisplayText(video.channelTitle)) {
    return { ok: false, reason: "Missing or unsafe display metadata" };
  }
  if (!isHttpUrl(video.thumbnailUrl)) {
    return { ok: false, reason: "Missing or unsafe thumbnail" };
  }
  const category = mapCategory(`${video.title} ${video.description}`);
  if (category === null) {
    return { ok: false, reason: "No supported finance category" };
  }
  return { ok: true, category };
};

export const isFinanceCategory = (value: string): value is FinanceCategory =>
  (FINANCE_CATEGORIES as readonly string[]).includes(value);
