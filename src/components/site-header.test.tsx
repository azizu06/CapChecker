import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/analyze",
}));

describe("SiteHeader", () => {
  it("renders the logo as a decorative image beside the wordmark", () => {
    const { container } = render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "CapCheck" })).toBeInTheDocument();
    expect(container.querySelector(".brand-mark img")).toHaveAttribute(
      "src",
      "/logo-mark.png",
    );
    expect(container.querySelector(".brand-mark img")).toHaveAttribute("alt", "");
  });
});
