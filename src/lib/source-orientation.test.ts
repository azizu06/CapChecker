import { describe, expect, it } from "vitest";

import { sourceOrientation } from "./source-orientation";

describe("sourceOrientation", () => {
  it("recognizes a YouTube Shorts URL as vertical", () => {
    expect(
      sourceOrientation({
        kind: "url",
        url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      }),
    ).toBe("vertical");
  });

  it("recognizes a TikTok URL as vertical", () => {
    expect(
      sourceOrientation({
        kind: "url",
        url: "https://www.tiktok.com/@capcheck/video/7460123456789012345",
      }),
    ).toBe("vertical");
  });

  it("recognizes an Instagram Reel URL as vertical", () => {
    expect(
      sourceOrientation({
        kind: "url",
        url: "https://www.instagram.com/reel/DFakeReelId/",
      }),
    ).toBe("vertical");
  });

  it.each([
    {
      label: "a standard YouTube watch URL",
      source: {
        kind: "url" as const,
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    },
    {
      label: "a shortened YouTube URL",
      source: {
        kind: "url" as const,
        url: "https://youtu.be/dQw4w9WgXcQ",
      },
    },
    {
      label: "a YouTube embed URL",
      source: {
        kind: "url" as const,
        url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      },
    },
    {
      label: "an unknown URL",
      source: {
        kind: "url" as const,
        url: "https://example.com/videos/market-update",
      },
    },
    {
      label: "an upload",
      source: { kind: "upload" as const, fileName: "market-update.mp4" },
    },
  ])("defaults $label to landscape", ({ source }) => {
    expect(sourceOrientation(source)).toBe("landscape");
  });
});
