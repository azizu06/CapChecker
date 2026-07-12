import { ScorecardSchema, type Scorecard } from "../domain/analysis";
import { CatalogItemSchema, type CatalogItem } from "../domain/feed";
import { DEMO_SCORECARDS } from "./scorecards";

const FIXTURE_ANALYZED_AT = "2026-07-11T15:00:00.000Z";

const thumbnailFor = (youtubeVideoId: string) =>
  `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`;

const watchUrlFor = (youtubeVideoId: string) =>
  `https://www.youtube.com/watch?v=${youtubeVideoId}`;

/**
 * A second vetted scorecard authored here (rather than reused from the demo
 * set) so the feed can show a distinct budgeting result. It flows through the
 * exact same `ScorecardSchema` contract as live analysis output.
 */
const emergencyFundScorecard: Scorecard = ScorecardSchema.parse({
  id: "feed-emergency-fund",
  source: {
    kind: "url",
    url: watchUrlFor("p7HKvqRI_Bo"),
    title: "How big should your emergency fund be?",
  },
  capScore: 11,
  capLabel: "no-cap",
  summary:
    "The budgeting guidance matches consumer-finance regulators: keep three to six months of expenses in an accessible account.",
  verifications: [
    {
      claim: {
        id: "emergency-claim-1",
        text: "An emergency fund should cover three to six months of expenses.",
        kind: "factual",
        checkable: true,
        timestampSeconds: 18,
      },
      verdict: "true",
      confidence: 0.95,
      explanation:
        "The CFPB recommends building savings that can cover several months of essential expenses.",
      evidence: [
        {
          id: "emergency-evidence-1",
          title: "An essential guide to building an emergency fund",
          publisher: "Consumer Financial Protection Bureau",
          url: "https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/",
          trustTier: "primary",
          stance: "supports",
          excerpt:
            "A common guideline is to keep enough to cover three to six months of expenses.",
        },
      ],
    },
    {
      claim: {
        id: "emergency-claim-2",
        text: "Emergency savings should stay in an account you can access quickly.",
        kind: "factual",
        checkable: true,
        timestampSeconds: 47,
      },
      verdict: "mostly-true",
      confidence: 0.9,
      explanation:
        "Regulators advise keeping emergency savings liquid, while noting the tradeoff with higher-yield but less-accessible options.",
      evidence: [
        {
          id: "emergency-evidence-2",
          title: "Where to keep your emergency fund",
          publisher: "Consumer Financial Protection Bureau",
          url: "https://www.consumerfinance.gov/about-us/blog/how-to-build-emergency-savings/",
          trustTier: "high",
          stance: "supports",
          excerpt:
            "Keep emergency savings somewhere safe and easy to reach when you need it.",
        },
      ],
    },
  ],
  hypeFindings: [],
  nextActions: [
    {
      id: "emergency-action-1",
      label: "Size your fund",
      description:
        "Use the CFPB guide to estimate three to six months of your own essential expenses.",
      evidenceId: "emergency-evidence-1",
    },
    {
      id: "emergency-action-2",
      label: "Pick an accessible account",
      description:
        "Compare liquid, insured options before moving your emergency savings.",
      evidenceId: "emergency-evidence-2",
    },
  ],
  generatedAt: FIXTURE_ANALYZED_AT,
});

const buildItem = (
  input: Omit<CatalogItem, "thumbnailUrl" | "url" | "capScore" | "capLabel"> & {
    url?: string;
  },
): CatalogItem =>
  CatalogItemSchema.parse({
    ...input,
    url: input.url ?? watchUrlFor(input.youtubeVideoId),
    thumbnailUrl: thumbnailFor(input.youtubeVideoId),
    capScore: input.scorecard.capScore,
    capLabel: input.scorecard.capLabel,
  });

const treasuryBills = buildItem({
  id: "feed-item-treasury-bills",
  youtubeVideoId: "PHe0bXAIuk0",
  title: "How Treasury bills actually work",
  channelTitle: "Principles by Ray Dalio",
  durationSeconds: 1860,
  category: "investing",
  tldr: "A clear, source-backed explainer on short-term Treasury bills — no cap.",
  scorecard: DEMO_SCORECARDS.legitimate,
  analyzedAt: FIXTURE_ANALYZED_AT,
});

const emergencyFund = buildItem({
  id: "feed-item-emergency-fund",
  youtubeVideoId: "p7HKvqRI_Bo",
  title: "How big should your emergency fund be?",
  channelTitle: "TED-Ed",
  durationSeconds: 312,
  category: "budgeting",
  tldr: "Three-to-six-months guidance that lines up with CFPB recommendations.",
  scorecard: emergencyFundScorecard,
  analyzedAt: FIXTURE_ANALYZED_AT,
});

export const FIXTURE_CATALOG_ITEMS: CatalogItem[] = [
  treasuryBills,
  emergencyFund,
];
