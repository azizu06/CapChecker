type Environment = Record<string, string | undefined>;

export type LiveSmokeSource =
  | { kind: "upload"; path: string }
  | { kind: "url"; url: string };

export function resolveLiveSmokeSource(
  environment: Environment,
): LiveSmokeSource | undefined {
  if (environment.CAPCHECK_LIVE_UPLOAD_PATH) {
    return { kind: "upload", path: environment.CAPCHECK_LIVE_UPLOAD_PATH };
  }
  if (environment.CAPCHECK_LIVE_SHORT_URL) {
    return { kind: "url", url: environment.CAPCHECK_LIVE_SHORT_URL };
  }
  return undefined;
}
