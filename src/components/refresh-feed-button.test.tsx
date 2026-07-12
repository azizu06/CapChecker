import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RefreshFeedButton } from "./refresh-feed-button";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("RefreshFeedButton", () => {
  it("preserves the refresh control while preventing retired production work", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<RefreshFeedButton readOnly />);

    const button = screen.getByRole("button", { name: "Refresh feed" });
    expect(button).toBeDisabled();
    expect(screen.getByText(/live refresh is disabled/i)).toBeVisible();
    await user.click(button);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
