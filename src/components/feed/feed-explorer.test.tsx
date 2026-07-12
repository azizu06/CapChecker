import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FIXTURE_CATALOG_ITEMS } from "@/fixtures/feed";

import { FeedExplorer } from "./feed-explorer";

describe("FeedExplorer", () => {
  it("searches useful video metadata and clears back to the full feed", async () => {
    const user = userEvent.setup();
    render(<FeedExplorer items={FIXTURE_CATALOG_ITEMS} />);

    const search = screen.getByRole("searchbox", {
      name: /search verified videos/i,
    });
    await user.type(search, "budgeting");

    expect(
      screen.getByRole("link", { name: /emergency fund/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /treasury bills/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear search/i }));

    expect(search).toHaveValue("");
    expect(screen.getAllByRole("listitem")).toHaveLength(
      FIXTURE_CATALOG_ITEMS.length,
    );
  });

  it("filters by finance category and resets every active filter", async () => {
    const user = userEvent.setup();
    render(<FeedExplorer items={FIXTURE_CATALOG_ITEMS} />);

    await user.click(screen.getByRole("button", { name: "Budgeting" }));

    expect(
      screen.getByRole("link", { name: /emergency fund/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /treasury bills/i }),
    ).not.toBeInTheDocument();

    await user.type(
      screen.getByRole("searchbox", { name: /search verified videos/i }),
      "emergency",
    );
    await user.click(screen.getByRole("button", { name: /reset filters/i }));

    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(
      FIXTURE_CATALOG_ITEMS.length,
    );
  });

  it("shows truthful no-match, stale, unavailable, and YouTube source states", async () => {
    const user = userEvent.setup();
    const [item] = FIXTURE_CATALOG_ITEMS;
    render(
      <FeedExplorer
        items={[
          {
            ...item,
            url: null,
            analyzedAt: "2020-05-01T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Source: YouTube")).toBeVisible();
    expect(screen.getByText("Video unavailable")).toBeVisible();
    expect(screen.getByText("Check may be stale")).toBeVisible();

    await user.type(
      screen.getByRole("searchbox", { name: /search verified videos/i }),
      "no-result-for-this-query",
    );
    expect(screen.getByRole("status")).toHaveTextContent(/no videos match/i);

    await user.click(screen.getByRole("button", { name: /show all videos/i }));
    expect(screen.getByRole("heading", { name: item.title })).toBeVisible();
  });
});
