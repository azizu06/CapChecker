import { Clock } from "lucide-react";
import Link from "next/link";

import { CATEGORY_LABELS, type CatalogItem } from "@/domain/feed";
import { formatCheckedAt, formatDuration } from "@/lib/format-feed";

import { CapScorePill } from "./cap-score-pill";

export function FeedCard({ item }: { item: CatalogItem }) {
  const duration = formatDuration(item.durationSeconds);

  return (
    <Link className="feed-card" href={`/feed/${item.id}`}>
      <div className="feed-thumb">
        {/* Grid uses a static thumbnail image — never an embedded iframe. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbnailUrl}
          alt=""
          width={480}
          height={360}
          loading="lazy"
        />
        {duration && <span className="feed-duration">{duration}</span>}
      </div>
      <div className="feed-card-body">
        <span className="feed-category">{CATEGORY_LABELS[item.category]}</span>
        <h2 className="feed-card-title">{item.title}</h2>
        <p className="feed-channel">{item.channelTitle}</p>
        <p className="feed-tldr">{item.tldr}</p>
        <div className="feed-card-foot">
          <CapScorePill capScore={item.capScore} capLabel={item.capLabel} />
          <time className="feed-checked" dateTime={item.analyzedAt}>
            <Clock aria-hidden="true" />
            Checked {formatCheckedAt(item.analyzedAt)}
          </time>
        </div>
      </div>
    </Link>
  );
}
