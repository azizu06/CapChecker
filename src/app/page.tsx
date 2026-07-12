import { TriangleAlert } from "lucide-react";

import { FeedCard } from "@/components/feed/feed-card";
import type { CatalogItem } from "@/domain/feed";
import { getCatalogRepository } from "@/server/feed/catalog-repository";

export const dynamic = "force-dynamic";

export default async function FeedHome() {
  let items: CatalogItem[] = [];
  let failed = false;

  try {
    const repository = await getCatalogRepository();
    items = await repository.listItems();
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
        <ul className="feed-grid" aria-label="Verified videos">
          {items.map((item) => (
            <li key={item.id}>
              <FeedCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
