import { ArrowLeft, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { ClaimCard } from "@/components/claim-card";
import { CountUp } from "@/components/react-bits/count-up";
import { ScoreMeter } from "@/components/score-meter";
import {
  CAP_LABELS,
  CATEGORY_LABELS,
  type CapLabel,
  type CatalogItem,
} from "@/domain/feed";
import { formatCheckedAt, formatDuration } from "@/lib/format-feed";
import { getCatalogRepository } from "@/server/feed/catalog-repository";

export const dynamic = "force-dynamic";

const toneClass: Record<CapLabel, string> = {
  "no-cap": "good-c",
  "some-cap": "warn-c",
  "full-of-cap": "bad-c",
};

function BackLink() {
  return (
    <Link className="feed-back" href="/">
      <ArrowLeft aria-hidden="true" />
      Back to feed
    </Link>
  );
}

function DetailState({
  role,
  heading,
  message,
}: {
  role?: "alert";
  heading: string;
  message: string;
}) {
  return (
    <main className="feed-detail">
      <BackLink />
      <div className="feed-state" role={role}>
        <TriangleAlert aria-hidden="true" />
        <div>
          <strong>{heading}</strong>
          <p>{message}</p>
        </div>
      </div>
    </main>
  );
}

export default async function FeedDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feedState?: string }>;
}) {
  const { id } = await params;
  const { feedState } = await searchParams;

  let item: CatalogItem | null = null;
  try {
    const repository = await getCatalogRepository();
    item = await repository.getItem(id);
  } catch {
    return (
      <DetailState
        role="alert"
        heading="This video is temporarily unavailable."
        message="We couldn't reach the verified-video catalog. Please try again in a moment."
      />
    );
  }

  if (!item) {
    return (
      <DetailState
        heading="We couldn't find that video."
        message="It may have been removed from the verified feed. Head back and pick another."
      />
    );
  }

  const fixtureUnavailable =
    process.env.NODE_ENV !== "production" &&
    process.env.CAPCHECK_FEED_MODE === "fixture" &&
    feedState === "unavailable";

  if (item.url === null || fixtureUnavailable) {
    return (
      <DetailState
        heading="This YouTube video is unavailable."
        message="The source video can no longer be played. Return to the feed to choose another vetted video."
      />
    );
  }

  const { scorecard } = item;
  const tone = toneClass[item.capLabel];
  const duration = formatDuration(item.durationSeconds);

  return (
    <main className="feed-detail">
      <BackLink />

      <header className="feed-detail-head">
        <span className="feed-category">{CATEGORY_LABELS[item.category]}</span>
        <h1>{item.title}</h1>
        <p className="feed-detail-meta">
          <span>{item.channelTitle}</span>
          {duration && <span>· {duration}</span>}
          <time dateTime={item.analyzedAt}>
            · Checked {formatCheckedAt(item.analyzedAt)}
          </time>
        </p>
      </header>

      <div className="feed-embed">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${item.youtubeVideoId}`}
          title={`YouTube video: ${item.title}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>

      <p className="feed-detail-tldr">{item.tldr}</p>

      <section
        className="panel score-header"
        aria-labelledby="feed-score-title"
        aria-roledescription="Cap Score"
      >
        <div className="score-left">
          <div
            className={`score-num ${tone}`}
            aria-label={`Cap Score ${item.capScore} out of 100`}
          >
            <CountUp to={item.capScore} />
          </div>
          <h2 id="feed-score-title" className={tone}>
            {CAP_LABELS[item.capLabel]}
          </h2>
          <ScoreMeter score={item.capScore} />
        </div>
        <div className="score-right">
          <p className="summary">{scorecard.summary}</p>
          <span className="strongest">
            <ShieldCheck aria-hidden="true" />
            Verified against{" "}
            {scorecard.verifications.length === 1
              ? "1 claim"
              : `${scorecard.verifications.length} claims`}
            .
          </span>
        </div>
      </section>

      <section aria-labelledby="feed-claims-title">
        <h2 id="feed-claims-title" className="feed-section-title">
          Claims &amp; evidence
        </h2>
        <div className="claims">
          {scorecard.verifications.map((verification) => (
            <ClaimCard key={verification.claim.id} verification={verification} />
          ))}
          {scorecard.skippedClaims?.map((claim) => (
            <ClaimCard key={claim.id} skippedClaim={claim} />
          ))}
        </div>
      </section>

      <p className="feed-analysis-stamp">
        Analysis generated{" "}
        <time dateTime={scorecard.generatedAt}>
          {formatCheckedAt(scorecard.generatedAt)}
        </time>
        . CapCheck verifies claims — it isn&rsquo;t financial advice.
      </p>
    </main>
  );
}
