import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FeedLoading from "./loading";

describe("FeedLoading", () => {
  it("announces that the verified catalog is loading", () => {
    render(<FeedLoading />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading verified videos",
    );
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
  });
});
