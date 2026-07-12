import type { Scorecard } from "@/domain/analysis";

export type SourceOrientation = "vertical" | "landscape";

const isDomain = (hostname: string, domain: string) =>
  hostname === domain || hostname.endsWith(`.${domain}`);

export function sourceOrientation(
  source: Scorecard["source"],
): SourceOrientation {
  if (source.kind === "url") {
    const url = new URL(source.url);

    if (
      isDomain(url.hostname, "youtube.com") &&
      url.pathname.toLowerCase().startsWith("/shorts/")
    ) {
      return "vertical";
    }

    if (isDomain(url.hostname, "tiktok.com")) return "vertical";

    if (
      (isDomain(url.hostname, "instagram.com") ||
        isDomain(url.hostname, "facebook.com") ||
        isDomain(url.hostname, "fb.com")) &&
      /^\/reels?\//i.test(url.pathname)
    ) {
      return "vertical";
    }
  }

  return "landscape";
}
