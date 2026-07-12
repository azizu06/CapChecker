"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import {
  CATEGORY_LABELS,
  FEED_CATEGORIES,
  type CatalogCategory,
  type CatalogItem,
} from "@/domain/feed";

import { FeedCard } from "./feed-card";

const clientReferenceTime =
  typeof window === "undefined" ? null : Date.now();
const subscribeToReferenceTime = () => () => undefined;
const getClientReferenceTime = () => clientReferenceTime;
const getServerReferenceTime = () => null;

export function FeedExplorer({ items }: { items: readonly CatalogItem[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CatalogCategory | "all">("all");
  const referenceTime = useSyncExternalStore(
    subscribeToReferenceTime,
    getClientReferenceTime,
    getServerReferenceTime,
  );

  const visibleItems = useMemo(() => {
    const categoryItems =
      category === "all"
        ? items
        : items.filter((item) => item.category === category);
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return categoryItems;

    return categoryItems.filter((item) =>
      [
        item.title,
        item.channelTitle,
        item.tldr,
        CATEGORY_LABELS[item.category],
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [category, items, search]);

  const hasActiveFilters = Boolean(search.trim()) || category !== "all";

  const reset = () => {
    setSearch("");
    setCategory("all");
  };

  return (
    <section
      className="feed-explorer"
      aria-label="Browse verified videos"
      data-ready={referenceTime !== null ? "true" : "false"}
    >
      <div className="feed-search">
        <Search aria-hidden="true" />
        <label className="visually-hidden" htmlFor="feed-search">
          Search verified videos
        </label>
        <input
          id="feed-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search videos, creators, or topics"
        />
        {search && (
          <button
            type="button"
            className="feed-search-clear"
            onClick={() => setSearch("")}
          >
            <X aria-hidden="true" />
            Clear search
          </button>
        )}
      </div>

      <div className="feed-filter-row">
        <div className="feed-filters" aria-label="Filter by category">
          <button
            type="button"
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            All
          </button>
          {FEED_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {CATEGORY_LABELS[value]}
            </button>
          ))}
        </div>
        {hasActiveFilters && (
          <button type="button" className="feed-reset" onClick={reset}>
            Reset filters
          </button>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <div className="feed-state feed-no-match" role="status">
          <div>
            <strong>No videos match those filters.</strong>
            <p>Try another search or show the complete vetted catalog.</p>
            <button type="button" className="feed-reset" onClick={reset}>
              Show all videos
            </button>
          </div>
        </div>
      ) : (
        <ul className="feed-grid" aria-label="Verified videos">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <FeedCard item={item} referenceTime={referenceTime} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
