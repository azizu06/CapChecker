import { ScorecardSchema } from "../domain/analysis";
import {
  CatalogItemSchema,
  type CatalogCategory,
  type CatalogItem,
} from "../domain/feed";

const watchUrlFor = (id: string) =>
  `https://www.youtube.com/watch?v=${id}`;
const thumbnailFor = (id: string) =>
  `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

type FixtureVideo = {
  id: string;
  youtubeVideoId: string;
  title: string;
  channelTitle: string;
  durationSeconds: number;
  category: CatalogCategory;
  tldr: string;
  capScore: number;
  claim: string;
  explanation: string;
  evidenceTitle: string;
  evidencePublisher: string;
  evidenceUrl: string;
  analyzedAt: string;
};

const videos: FixtureVideo[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    youtubeVideoId: "bO0h3Of-WZ4",
    title: "Investor.gov: Knowledge Worth Celebrating (Diversification)",
    channelTitle: "U.S. Securities and Exchange Commission",
    durationSeconds: 16,
    category: "investing",
    tldr: "A concise SEC reminder that diversification can reduce concentration risk.",
    capScore: 5,
    claim: "Diversifying investments can reduce portfolio risk.",
    explanation:
      "Investor.gov explains that spreading money among investments can reduce risk, while not eliminating losses.",
    evidenceTitle: "Diversification",
    evidencePublisher: "Investor.gov",
    evidenceUrl: "https://www.investor.gov/introduction-investing/investing-basics/glossary/diversification",
    analyzedAt: "2026-07-11T20:08:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    youtubeVideoId: "ozbGWLtZdoY",
    title: "What Goes Into Your Credit Score?",
    channelTitle: "Two Cents",
    durationSeconds: 294,
    category: "credit",
    tldr: "A practical overview of the payment and borrowing signals used in credit scores.",
    capScore: 12,
    claim: "Payment history is an important factor in credit scoring.",
    explanation:
      "The CFPB identifies bill-payment history as one of the inputs commonly used to calculate credit scores.",
    evidenceTitle: "What is a credit score?",
    evidencePublisher: "Consumer Financial Protection Bureau",
    evidenceUrl: "https://www.consumerfinance.gov/ask-cfpb/what-is-a-credit-score-en-315/",
    analyzedAt: "2026-07-11T20:07:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    youtubeVideoId: "jwML94IOW0s",
    title: "What is a credit score?",
    channelTitle: "Khan Academy",
    durationSeconds: 114,
    category: "credit",
    tldr: "A short explanation of how a credit score summarizes information in a credit report.",
    capScore: 8,
    claim: "A credit score is calculated from information in a credit report.",
    explanation:
      "The CFPB says scoring models use information from credit reports to calculate a score.",
    evidenceTitle: "What is a credit score?",
    evidencePublisher: "Consumer Financial Protection Bureau",
    evidenceUrl: "https://www.consumerfinance.gov/ask-cfpb/what-is-a-credit-score-en-315/",
    analyzedAt: "2026-07-11T20:06:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    youtubeVideoId: "6cRg9bnSnvg",
    title: "How Do Tax Brackets Actually Work?",
    channelTitle: "Two Cents",
    durationSeconds: 416,
    category: "taxes",
    tldr: "A clear walkthrough of marginal tax brackets and why a raise does not tax every dollar at one higher rate.",
    capScore: 9,
    claim: "Federal income tax brackets apply different rates to different portions of taxable income.",
    explanation:
      "IRS rate schedules apply progressively higher rates only to taxable income within each bracket.",
    evidenceTitle: "Federal income tax rates and brackets",
    evidencePublisher: "Internal Revenue Service",
    evidenceUrl: "https://www.irs.gov/filing/federal-income-tax-rates-and-brackets",
    analyzedAt: "2026-07-11T20:05:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    youtubeVideoId: "vftjBTjFlzI",
    title: "Why You NEED an Emergency Fund!",
    channelTitle: "Two Cents",
    durationSeconds: 425,
    category: "budgeting",
    tldr: "Emergency savings can absorb unexpected expenses without immediately relying on debt.",
    capScore: 10,
    claim: "An emergency fund can help cover unplanned expenses.",
    explanation:
      "The CFPB describes emergency savings as cash set aside for unplanned expenses or financial emergencies.",
    evidenceTitle: "An essential guide to building an emergency fund",
    evidencePublisher: "Consumer Financial Protection Bureau",
    evidenceUrl: "https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/",
    analyzedAt: "2026-07-11T20:04:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    youtubeVideoId: "sVKQn2I4HDM",
    title: "Budgeting Basics!",
    channelTitle: "Two Cents",
    durationSeconds: 313,
    category: "budgeting",
    tldr: "A beginner-friendly method for comparing income, expenses, and savings goals.",
    capScore: 7,
    claim: "A budget compares income with spending and saving.",
    explanation:
      "The CFPB budgeting worksheet organizes income and expenses so households can see what remains for goals.",
    evidenceTitle: "Creating a cash flow budget",
    evidencePublisher: "Consumer Financial Protection Bureau",
    evidenceUrl: "https://www.consumerfinance.gov/consumer-tools/educator-tools/your-money-your-goals/toolkit/",
    analyzedAt: "2026-07-11T20:03:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    youtubeVideoId: "TNC1frNq20c",
    title: "Are 401(k)s a Financial Silver Bullet?",
    channelTitle: "Two Cents",
    durationSeconds: 393,
    category: "retirement",
    tldr: "A balanced look at 401(k) tax advantages, employer plans, fees, and contribution tradeoffs.",
    capScore: 14,
    claim: "A 401(k) is an employer-sponsored retirement savings plan.",
    explanation:
      "The Department of Labor describes 401(k) plans as employer-sponsored defined contribution retirement plans.",
    evidenceTitle: "Types of retirement plans",
    evidencePublisher: "U.S. Department of Labor",
    evidenceUrl: "https://www.dol.gov/general/topic/retirement/typesofplans",
    analyzedAt: "2026-07-11T20:02:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000008",
    youtubeVideoId: "vMJ2dkSc8Ok",
    title: "What The Heck Is an IRA?",
    channelTitle: "Two Cents",
    durationSeconds: 411,
    category: "retirement",
    tldr: "An accessible introduction to traditional and Roth individual retirement arrangements.",
    capScore: 11,
    claim: "Traditional and Roth IRAs have different tax treatment.",
    explanation:
      "IRS guidance distinguishes potentially deductible traditional IRA contributions from qualified tax-free Roth distributions.",
    evidenceTitle: "Individual retirement arrangements",
    evidencePublisher: "Internal Revenue Service",
    evidenceUrl: "https://www.irs.gov/retirement-plans/individual-retirement-arrangements-iras",
    analyzedAt: "2026-07-11T20:01:00.000Z",
  },
];

const buildItem = (video: FixtureVideo): CatalogItem => {
  const url = watchUrlFor(video.youtubeVideoId);
  const evidenceId = `${video.youtubeVideoId}-evidence`;
  const scorecard = ScorecardSchema.parse({
    id: `feed-scorecard-${video.youtubeVideoId}`,
    source: { kind: "url", url, title: video.title },
    capScore: video.capScore,
    capLabel: "no-cap",
    summary: video.tldr,
    verifications: [
      {
        claim: {
          id: `${video.youtubeVideoId}-claim`,
          text: video.claim,
          kind: "factual",
          checkable: true,
          timestampSeconds: Math.min(12, video.durationSeconds),
        },
        verdict: "true",
        confidence: 0.92,
        explanation: video.explanation,
        evidence: [
          {
            id: evidenceId,
            title: video.evidenceTitle,
            publisher: video.evidencePublisher,
            url: video.evidenceUrl,
            trustTier: "primary",
            stance: "supports",
            excerpt: video.explanation,
          },
        ],
      },
    ],
    hypeFindings: [],
    nextActions: [
      {
        id: `${video.youtubeVideoId}-action`,
        label: "Read the primary guidance",
        description: `Compare the video with ${video.evidencePublisher}'s guidance before acting.`,
        evidenceId,
      },
    ],
    generatedAt: video.analyzedAt,
  });

  return CatalogItemSchema.parse({
    id: video.id,
    youtubeVideoId: video.youtubeVideoId,
    url,
    title: video.title,
    channelTitle: video.channelTitle,
    thumbnailUrl: thumbnailFor(video.youtubeVideoId),
    durationSeconds: video.durationSeconds,
    category: video.category,
    tldr: video.tldr,
    capScore: scorecard.capScore,
    capLabel: scorecard.capLabel,
    scorecard,
    analyzedAt: video.analyzedAt,
  });
};

export const FIXTURE_CATALOG_ITEMS: CatalogItem[] = videos.map(buildItem);
