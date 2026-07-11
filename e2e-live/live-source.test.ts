import { describe, expect, it } from "vitest";

import { resolveLiveSmokeSource } from "./live-source";

describe("live browser smoke source", () => {
  it("prefers an explicit upload path over a URL", () => {
    expect(
      resolveLiveSmokeSource({
        CAPCHECK_LIVE_UPLOAD_PATH: "/tmp/prepared.mp4",
        CAPCHECK_LIVE_SHORT_URL: "https://youtu.be/example",
      }),
    ).toEqual({ kind: "upload", path: "/tmp/prepared.mp4" });
  });

  it("uses a prepared short URL when no upload is configured", () => {
    expect(
      resolveLiveSmokeSource({
        CAPCHECK_LIVE_SHORT_URL: "https://youtu.be/example",
      }),
    ).toEqual({ kind: "url", url: "https://youtu.be/example" });
  });

  it("returns no source when neither explicit input is configured", () => {
    expect(resolveLiveSmokeSource({})).toBeUndefined();
  });
});
