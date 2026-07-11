import {
  ErrorEventSchema,
  ScorecardSchema,
  type AnalysisEvent,
  type Scorecard,
} from "../domain/analysis";

const FIXTURE_GENERATED_AT = "2026-07-11T15:00:00.000Z";

const buildScorecard = (
  input: Omit<Scorecard, "generatedAt">,
): Scorecard =>
  ScorecardSchema.parse({ ...input, generatedAt: FIXTURE_GENERATED_AT });

const buildErrorEvent = (
  error: Extract<AnalysisEvent, { type: "error" }>["error"],
): Extract<AnalysisEvent, { type: "error" }> =>
  ErrorEventSchema.parse({ type: "error", error });

const mixed = buildScorecard({
  id: "scorecard-mixed",
  source: {
    kind: "url",
    url: "https://www.youtube.com/shorts/capcheck-mixed",
    title: "Three stock claims in sixty seconds",
  },
  capScore: 52,
  capLabel: "some-cap",
  summary:
    "The video mixes a supported market fact with an unsupported forecast and a false guarantee.",
  verifications: [
    {
      claim: {
        id: "mixed-claim-1",
        text: "The S&P 500 gained more than 20% in 2023.",
        kind: "factual",
        checkable: true,
        timestampSeconds: 7,
      },
      verdict: "true",
      confidence: 0.98,
      explanation: "The official index factsheet reports a 2023 total return above 20%.",
      evidence: [
        {
          id: "mixed-evidence-1",
          title: "S&P 500 factsheet",
          publisher: "S&P Dow Jones Indices",
          url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500/",
          trustTier: "high",
          stance: "supports",
          excerpt: "The published annual return supports the historical claim.",
        },
      ],
    },
    {
      claim: {
        id: "mixed-claim-2",
        text: "This semiconductor stock will double before December.",
        kind: "predictive",
        checkable: true,
        timestampSeconds: 22,
      },
      verdict: "unverifiable",
      confidence: 0.82,
      explanation: "A future price target cannot be established as fact from current evidence.",
      evidence: [
        {
          id: "mixed-evidence-2",
          title: "Investor bulletin: investment advice",
          publisher: "U.S. Securities and Exchange Commission",
          url: "https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins",
          trustTier: "primary",
          stance: "context",
          excerpt: "Investors should independently evaluate promotional price predictions.",
        },
        {
          id: "mixed-evidence-2-analysis",
          title: "Understanding analyst price targets",
          publisher: "Investopedia",
          url: "https://www.investopedia.com/terms/p/pricetarget.asp",
          trustTier: "medium",
          stance: "context",
          excerpt: "Price targets are estimates rather than guaranteed future values.",
        },
        {
          id: "mixed-evidence-2-promotion",
          title: "Creator's promotional price target",
          publisher: "Unverified creator page",
          url: "https://example.com/promotional-stock-tip",
          trustTier: "low",
          stance: "supports",
          excerpt: "The page repeats the prediction without methods or independent sourcing.",
        },
      ],
    },
    {
      claim: {
        id: "mixed-claim-3",
        text: "You cannot lose money if you buy before earnings.",
        kind: "factual",
        checkable: true,
        timestampSeconds: 41,
      },
      verdict: "false",
      confidence: 0.99,
      explanation: "Stocks can lose value around earnings and no purchase timing removes market risk.",
      evidence: [
        {
          id: "mixed-evidence-3",
          title: "Understanding investment risk",
          publisher: "FINRA",
          url: "https://www.finra.org/investors/investing/investing-basics/risk",
          trustTier: "primary",
          stance: "contradicts",
          excerpt: "All investments carry risk, including the possible loss of principal.",
        },
      ],
    },
  ],
  hypeFindings: [
    {
      id: "mixed-hype-1",
      phrase: "You cannot lose money",
      category: "guarantee",
      severity: "high",
      explanation: "Absolute safety language hides ordinary market risk.",
    },
    {
      id: "mixed-hype-2",
      phrase: "Buy before earnings",
      category: "urgency",
      severity: "medium",
      explanation: "The deadline pressures viewers to act before doing research.",
    },
  ],
  nextActions: [
    {
      id: "mixed-action-1",
      label: "Review the latest filing",
      description: "Compare the creator's claims with the company's latest SEC filing.",
      url: "https://www.sec.gov/edgar/search/",
    },
    {
      id: "mixed-action-2",
      label: "Check your risk tolerance",
      description: "Decide how much loss you could absorb before acting on a prediction.",
    },
  ],
});

const scammy = buildScorecard({
  id: "scorecard-scammy",
  source: {
    kind: "url",
    url: "https://www.tiktok.com/@capcheck/video/scammy-demo",
    title: "Guaranteed crypto returns",
  },
  capScore: 94,
  capLabel: "full-of-cap",
  summary:
    "The video uses false guarantees and manufactured urgency without credible supporting evidence.",
  verifications: [
    {
      claim: {
        id: "scammy-claim-1",
        text: "This token is guaranteed to return 10x this month.",
        kind: "predictive",
        checkable: true,
        timestampSeconds: 5,
      },
      verdict: "false",
      confidence: 0.99,
      explanation: "No investment return is guaranteed, and the promoter provides no verifiable basis.",
      evidence: [
        {
          id: "scammy-evidence-1",
          title: "Crypto asset investment scams",
          publisher: "U.S. Securities and Exchange Commission",
          url: "https://www.investor.gov/protect-your-investments/fraud/types-fraud/crypto-asset-investment-scams",
          trustTier: "primary",
          stance: "contradicts",
          excerpt: "Promises of guaranteed high returns are a common investment-fraud warning sign.",
        },
      ],
    },
    {
      claim: {
        id: "scammy-claim-2",
        text: "The founders are registered with the SEC.",
        kind: "factual",
        checkable: true,
        timestampSeconds: 31,
      },
      verdict: "false",
      confidence: 0.95,
      explanation: "The claimed registration is not present in the regulator's public search.",
      evidence: [
        {
          id: "scammy-evidence-2",
          title: "Investment Adviser Public Disclosure",
          publisher: "U.S. Securities and Exchange Commission",
          url: "https://adviserinfo.sec.gov/",
          trustTier: "primary",
          stance: "contradicts",
          excerpt: "The public registration search does not corroborate the named founders.",
        },
      ],
    },
  ],
  hypeFindings: [
    {
      id: "scammy-hype-1",
      phrase: "Guaranteed 10x",
      category: "guarantee",
      severity: "high",
      explanation: "The promise removes uncertainty that always exists in speculative assets.",
    },
    {
      id: "scammy-hype-2",
      phrase: "Only available tonight",
      category: "urgency",
      severity: "high",
      explanation: "The artificial deadline discourages independent verification.",
    },
  ],
  nextActions: [
    {
      id: "scammy-action-1",
      label: "Do not send funds",
      description: "Pause the transaction until the promoter and offering are independently verified.",
    },
    {
      id: "scammy-action-2",
      label: "Check the registration",
      description: "Search the SEC and FINRA databases using the promoter's legal name.",
      url: "https://brokercheck.finra.org/",
    },
  ],
});

const legitimate = buildScorecard({
  id: "scorecard-legitimate",
  source: {
    kind: "url",
    url: "https://www.youtube.com/shorts/capcheck-legitimate",
    title: "How Treasury bills work",
  },
  capScore: 8,
  capLabel: "no-cap",
  summary:
    "The factual claims are supported by primary government sources and avoid misleading promises.",
  verifications: [
    {
      claim: {
        id: "legitimate-claim-1",
        text: "Treasury bills mature in one year or less.",
        kind: "factual",
        checkable: true,
        timestampSeconds: 9,
      },
      verdict: "true",
      confidence: 0.99,
      explanation: "TreasuryDirect describes bills as short-term securities with maturities up to 52 weeks.",
      evidence: [
        {
          id: "legitimate-evidence-1",
          title: "Treasury bills",
          publisher: "U.S. Department of the Treasury",
          url: "https://www.treasurydirect.gov/marketable-securities/treasury-bills/",
          trustTier: "primary",
          stance: "supports",
          excerpt: "Bills are offered with maturities ranging from several weeks through 52 weeks.",
        },
      ],
    },
    {
      claim: {
        id: "legitimate-claim-2",
        text: "Investors receive the face value when a Treasury bill matures.",
        kind: "factual",
        checkable: true,
        timestampSeconds: 24,
      },
      verdict: "mostly-true",
      confidence: 0.94,
      explanation: "The description is accurate for bills held to maturity, though early sales can change outcomes.",
      evidence: [
        {
          id: "legitimate-evidence-2",
          title: "Treasury bills",
          publisher: "U.S. Department of the Treasury",
          url: "https://www.treasurydirect.gov/marketable-securities/treasury-bills/",
          trustTier: "primary",
          stance: "supports",
          excerpt: "The investor receives the bill's face value at maturity.",
        },
      ],
    },
  ],
  hypeFindings: [],
  nextActions: [
    {
      id: "legitimate-action-1",
      label: "Compare current rates",
      description: "Review current auction results before choosing a maturity.",
      url: "https://www.treasurydirect.gov/auctions/announcements-data-results/",
    },
  ],
});

const partialFailure = buildScorecard({
  id: "scorecard-partial-failure",
  source: {
    kind: "upload",
    fileName: "demo-earnings-claims.mp4",
    title: "Earnings claims with one unavailable source",
  },
  capScore: 61,
  capLabel: "some-cap",
  summary:
    "One claim is contradicted; another remains unverifiable because its cited source could not be retrieved.",
  verifications: [
    {
      claim: {
        id: "partial-claim-1",
        text: "The company has never reported a quarterly loss.",
        kind: "factual",
        checkable: true,
        timestampSeconds: 12,
      },
      verdict: "false",
      confidence: 0.97,
      explanation: "The company's filed statements include quarters with a net loss.",
      evidence: [
        {
          id: "partial-evidence-1",
          title: "Company filings search",
          publisher: "U.S. Securities and Exchange Commission",
          url: "https://www.sec.gov/edgar/search/",
          trustTier: "primary",
          stance: "contradicts",
          excerpt: "Filed quarterly statements report periods with negative net income.",
        },
      ],
    },
    {
      claim: {
        id: "partial-claim-2",
        text: "A private analyst report projects 40% revenue growth.",
        kind: "factual",
        checkable: true,
        timestampSeconds: 38,
      },
      verdict: "unverifiable",
      confidence: 0.72,
      explanation: "The named report was unavailable, so the projection could not be corroborated.",
      evidence: [],
    },
  ],
  hypeFindings: [
    {
      id: "partial-hype-1",
      phrase: "Everyone on Wall Street agrees",
      category: "popularity",
      severity: "medium",
      explanation: "The consensus claim is unsupported by accessible evidence.",
    },
  ],
  nextActions: [
    {
      id: "partial-action-1",
      label: "Find the original report",
      description: "Ask for the report title, author, and publication date before relying on the projection.",
    },
  ],
});

export const DEMO_SCORECARDS = {
  scammy,
  legitimate,
  mixed,
  partialFailure,
};

export const DEMO_FATAL_ERROR = buildErrorEvent({
  code: "ANALYSIS_TEMPORARILY_UNAVAILABLE",
  message:
    "CapCheck could not finish this analysis. Your input is safe to retry.",
  retryable: true,
});
