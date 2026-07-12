import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PortfolioDemoNotice } from "./portfolio-demo-notice";

describe("PortfolioDemoNotice", () => {
  it("keeps the archived project useful without offering retired live actions", () => {
    render(<PortfolioDemoNotice feature="analyzer" />);

    expect(
      screen.getByRole("heading", { name: "Live analysis is retired" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse the verified feed" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
