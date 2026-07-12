import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { FeedExplorer } from "@/components/feed/feed-explorer";
import { RefreshFeedButton } from "@/components/refresh-feed-button";
import type { CatalogItem } from "@/domain/feed";
import { getCatalogRepository } from "@/server/feed/catalog-repository";

export const dynamic = "force-dynamic";

export default async function FeedHome({
  searchParams,
}: {
  searchParams: Promise<{ feedState?: string }>;
}) {
  let items: CatalogItem[] = [];
  let failed = false;
  const { feedState } = await searchParams;
  const fixtureState =
    process.env.NODE_ENV !== "production" &&
    process.env.CAPCHECK_FEED_MODE === "fixture"
      ? feedState
      : undefined;

  try {
    const repository = await getCatalogRepository();
    items = await repository.listItems();
    if (fixtureState === "empty") items = [];
    if (fixtureState === "error") failed = true;
    if (fixtureState === "unavailable" && items[0]) {
      items = [{ ...items[0], url: null }];
    }
    if (fixtureState === "long" && items[0]) {
      const longValue = "metadata".repeat(60);
      items = [
        {
          ...items[0],
          title: longValue,
          channelTitle: longValue,
          tldr: longValue,
        },
      ];
    }
  } catch {
    failed = true;
  }

  return (
    <main className="feed-page">
      <section className="feed-intro">
        <p className="kicker">Verified feed</p>
        <h1>CapCheck-vetted finance videos</h1>
        <p className="feed-lede">
          Every video here was pulled through CapCheck&rsquo;s analysis and kept
          only if its claims held up. Open one to see the Cap Score, the
          evidence, and the citations behind it.
        </p>
        <RefreshFeedButton />
      </section>

      {failed ? (
        <div className="feed-state" role="alert">
          <TriangleAlert aria-hidden="true" />
          <div>
            <strong>The feed is temporarily unavailable.</strong>
            <p>
              We couldn&rsquo;t reach the verified-video catalog. Please refresh
              in a moment.
            </p>
            <Link className="feed-state-action" href="/">
              Try feed again
            </Link>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="feed-state">
          <div>
            <strong>No vetted videos yet.</strong>
            <p>
              CapCheck hasn&rsquo;t published a verified video to the feed yet.
              Check back after the next refresh.
            </p>
          </div>
        </div>
      ) : (
        <FeedExplorer items={items} />
      )}
    </main>
  );
}
