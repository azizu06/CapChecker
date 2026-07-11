import type { ErrorEvent, ProgressEvent } from "@/domain/analysis";

import { VideoMediaTypeError } from "./media-type";

export type IngestionErrorDetails = {
  code: string;
  message: string;
  retryable: boolean;
  offerUploadFallback: boolean;
};

export class IngestionError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly offerUploadFallback: boolean;

  constructor(details: IngestionErrorDetails) {
    super(details.message);
    this.name = "IngestionError";
    this.code = details.code;
    this.retryable = details.retryable;
    this.offerUploadFallback = details.offerUploadFallback;
  }
}

export class BoundaryError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "BoundaryError";
  }
}

const cancellationFor = (signal: AbortSignal) => {
  const reason = signal.reason;
  return (reason instanceof DOMException || reason instanceof Error) &&
    reason.name === "AbortError"
    ? reason
    : new DOMException("The operation was aborted", "AbortError");
};

export function mapIngestionError(cause: unknown): ErrorEvent | undefined {
  if (
    cause instanceof DOMException
      ? cause.name === "AbortError"
      : cause instanceof Error && cause.name === "AbortError"
  ) {
    return undefined;
  }

  if (cause instanceof IngestionError) {
    return {
      type: "error",
      error: {
        code: cause.code,
        message: cause.message,
        retryable: cause.retryable,
      },
    };
  }

  if (cause instanceof VideoMediaTypeError) {
    return {
      type: "error",
      error: {
        code: cause.code,
        message: cause.message,
        retryable: false,
      },
    };
  }

  return {
    type: "error",
    error: {
      code: "VIDEO_INGESTION_FAILED",
      message: "CapCheck could not prepare this video. Try again.",
      retryable: true,
    },
  };
}

export type SupportedVideoMimeType =
  | "video/mp4"
  | "video/quicktime"
  | "video/webm";

export type GeminiFile = {
  name?: string;
  uri?: string;
  mimeType?: SupportedVideoMimeType;
  state: "STATE_UNSPECIFIED" | "PROCESSING" | "ACTIVE" | "FAILED";
};

export type ActiveGeminiFile = {
  name: string;
  uri: string;
  mimeType: SupportedVideoMimeType;
};

export type VideoIngestionSource =
  | { kind: "url"; url: string }
  | {
      kind: "upload";
      fileName: string;
      mimeType: string;
      bytes: Uint8Array;
    };

export type VideoIngestionDependencies = {
  temporaryFiles: {
    createDirectory(): Promise<string>;
    stageUpload(input: {
      directory: string;
      fileName: string;
      bytes: Uint8Array;
      signal: AbortSignal;
    }): Promise<{ path: string; fileName: string }>;
    removeDirectory(directory: string): Promise<void>;
  };
  ytDlp: {
    download(input: {
      url: string;
      directory: string;
      signal: AbortSignal;
    }): Promise<{ path: string; fileName: string; size: number }>;
  };
  mime: {
    detect(path: string, declaredType?: string): Promise<SupportedVideoMimeType>;
  };
  geminiFiles: {
    upload(input: {
      path: string;
      displayName: string;
      mimeType: SupportedVideoMimeType;
      signal: AbortSignal;
    }): Promise<GeminiFile>;
    get(name: string, signal: AbortSignal): Promise<GeminiFile>;
    delete(name: string, signal: AbortSignal): Promise<void>;
  };
  now(): number;
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
  reportCleanupFailure(failure: IngestionError): void;
};

export type VideoIngestionPolicy = {
  uploadAttempts: number;
  downloadTimeoutMs: number;
  pollIntervalMs: number;
  maxPollAttempts: number;
  activationTimeoutMs: number;
  cleanupAttempts: number;
  cleanupRetryDelayMs: number;
  maxVideoBytes: number;
};

export const DEFAULT_VIDEO_INGESTION_POLICY: VideoIngestionPolicy = {
  uploadAttempts: 2,
  downloadTimeoutMs: 120_000,
  pollIntervalMs: 2_000,
  maxPollAttempts: 60,
  activationTimeoutMs: 120_000,
  cleanupAttempts: 3,
  cleanupRetryDelayMs: 1_000,
  maxVideoBytes: 50 * 1024 * 1024,
};

type VideoIngestionOptions = {
  signal: AbortSignal;
  onProgress(event: ProgressEvent): void;
};

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);
const tikTokHosts = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

const isSupportedVideoUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return false;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (youtubeHosts.has(url.hostname)) {
      return parts[0] === "shorts" && Boolean(parts[1]);
    }
    if (url.hostname === "youtu.be") return Boolean(parts[0]);
    if (tikTokHosts.has(url.hostname)) return parts.length > 0;
    return false;
  } catch {
    return false;
  }
};

const rejectFailedProcessing = (file: GeminiFile) => {
  if (file.state === "FAILED") {
    throw new IngestionError({
      code: "GEMINI_PROCESSING_FAILED",
      message: "Gemini could not prepare this video. Try another file.",
      retryable: true,
      offerUploadFallback: true,
    });
  }
};

const throwProcessingTimeout = (): never => {
  throw new IngestionError({
    code: "GEMINI_PROCESSING_TIMEOUT",
    message: "Gemini took too long to prepare this video. Try again.",
    retryable: true,
    offerUploadFallback: false,
  });
};

export function createVideoIngestor(
  dependencies: VideoIngestionDependencies,
  policy: VideoIngestionPolicy = DEFAULT_VIDEO_INGESTION_POLICY,
) {
  return {
    async withActiveFile<Result>(
      source: VideoIngestionSource,
      options: VideoIngestionOptions,
      consume: (file: ActiveGeminiFile) => Promise<Result>,
    ): Promise<Result> {
      if (source.kind === "url" && !isSupportedVideoUrl(source.url)) {
        throw new IngestionError({
          code: "UNSUPPORTED_VIDEO_URL",
          message:
            "Use a public TikTok or YouTube Shorts link, or upload the video file instead.",
          retryable: false,
          offerUploadFallback: true,
        });
      }
      if (
        source.kind === "upload" &&
        source.bytes.byteLength > policy.maxVideoBytes
      ) {
        throw new IngestionError({
          code: "UPLOAD_TOO_LARGE",
          message: "Choose a video that is 50 MB or smaller.",
          retryable: false,
          offerUploadFallback: false,
        });
      }

      const directory = await dependencies.temporaryFiles.createDirectory();
      let remoteName: string | undefined;
      let primaryFailure: unknown;

      try {
        options.onProgress({
          type: "progress",
          stage: "fetching",
          message:
            source.kind === "url"
              ? "Downloading the source video"
              : "Staging the uploaded video",
        });

        let localFile: { path: string; fileName: string };
        if (source.kind === "url") {
          let downloaded: { path: string; fileName: string; size: number };
          const downloadDeadline = new AbortController();
          const downloadTimer = setTimeout(
            () =>
              downloadDeadline.abort(
                new DOMException("Download timed out", "TimeoutError"),
              ),
            policy.downloadTimeoutMs,
          );
          try {
            downloaded = await dependencies.ytDlp.download({
              url: source.url,
              directory,
              signal: AbortSignal.any([
                options.signal,
                downloadDeadline.signal,
              ]),
            });
          } catch (cause) {
            if (options.signal.aborted) throw cause;
            throw new IngestionError({
              code: "SOURCE_VIDEO_UNAVAILABLE",
              message:
                "We could not download that public video. Upload the video file instead.",
              retryable: false,
              offerUploadFallback: true,
            });
          } finally {
            clearTimeout(downloadTimer);
          }
          if (downloaded.size > policy.maxVideoBytes) {
            throw new IngestionError({
              code: "SOURCE_VIDEO_TOO_LARGE",
              message: "Choose a video that is 50 MB or smaller.",
              retryable: false,
              offerUploadFallback: true,
            });
          }
          localFile = downloaded;
        } else {
          localFile = await dependencies.temporaryFiles.stageUpload({
            directory,
            fileName: source.fileName,
            bytes: source.bytes,
            signal: options.signal,
          });
        }
        const mimeType = await dependencies.mime.detect(
          localFile.path,
          source.kind === "upload" ? source.mimeType : undefined,
        );

        options.onProgress({
          type: "progress",
          stage: "processing",
          message: "Preparing the video with Gemini",
        });

        let file: GeminiFile | undefined;
        for (let attempt = 1; attempt <= policy.uploadAttempts; attempt += 1) {
          try {
            file = await dependencies.geminiFiles.upload({
              path: localFile.path,
              displayName: localFile.fileName,
              mimeType,
              signal: options.signal,
            });
            break;
          } catch (cause) {
            if (
              !(cause instanceof BoundaryError) ||
              !cause.retryable ||
              attempt === policy.uploadAttempts
            ) {
              if (options.signal.aborted) throw cause;
              throw new IngestionError({
                code: "GEMINI_UPLOAD_FAILED",
                message: "Gemini could not accept this video. Try again.",
                retryable:
                  cause instanceof BoundaryError ? cause.retryable : true,
                offerUploadFallback: false,
              });
            }
            await dependencies.sleep(policy.pollIntervalMs, options.signal);
          }
        }
        if (!file) throw new Error("Gemini upload did not return a file");
        remoteName = file.name;
        rejectFailedProcessing(file);
        const activationStartedAt = dependencies.now();
        const activationDeadline = new AbortController();
        const activationTimer = setTimeout(
          () =>
            activationDeadline.abort(
              new DOMException("Activation timed out", "TimeoutError"),
            ),
          policy.activationTimeoutMs,
        );
        const activationSignal = AbortSignal.any([
          options.signal,
          activationDeadline.signal,
        ]);

        try {
          for (
            let attempt = 0;
            file.state !== "ACTIVE" && attempt < policy.maxPollAttempts;
            attempt += 1
          ) {
            if (
              dependencies.now() - activationStartedAt >=
              policy.activationTimeoutMs
            ) {
              throwProcessingTimeout();
            }
            try {
              await dependencies.sleep(
                policy.pollIntervalMs,
                activationSignal,
              );
            } catch (cause) {
              if (options.signal.aborted) throw cause;
              if (activationDeadline.signal.aborted) throwProcessingTimeout();
              throw cause;
            }
            if (
              dependencies.now() - activationStartedAt >=
              policy.activationTimeoutMs
            ) {
              throwProcessingTimeout();
            }
            if (!remoteName) {
              throw new Error("Gemini upload returned no file name");
            }
            try {
              file = await dependencies.geminiFiles.get(
                remoteName,
                activationSignal,
              );
            } catch (cause) {
              if (options.signal.aborted) throw cause;
              if (activationDeadline.signal.aborted) throwProcessingTimeout();
              if (cause instanceof BoundaryError && cause.retryable) continue;
              throw new IngestionError({
                code: "GEMINI_PROCESSING_FAILED",
                message:
                  "Gemini could not prepare this video. Try another file.",
                retryable:
                  cause instanceof BoundaryError ? cause.retryable : true,
                offerUploadFallback: true,
              });
            }
            if (
              activationDeadline.signal.aborted ||
              dependencies.now() - activationStartedAt >=
                policy.activationTimeoutMs
            ) {
              throwProcessingTimeout();
            }
            rejectFailedProcessing(file);
          }
        } finally {
          clearTimeout(activationTimer);
        }

        if (file.state !== "ACTIVE") {
          throwProcessingTimeout();
        }
        if (!file.name || !file.uri || !file.mimeType) {
          throw new IngestionError({
            code: "GEMINI_PROTOCOL_ERROR",
            message: "Gemini returned an incomplete video reference. Try again.",
            retryable: true,
            offerUploadFallback: false,
          });
        }

        return await consume({
          name: file.name,
          uri: file.uri,
          mimeType: file.mimeType,
        });
      } catch (cause) {
        const failure = options.signal.aborted
          ? cancellationFor(options.signal)
          : cause;
        primaryFailure = failure;
        throw failure;
      } finally {
        const cleanupSignal = new AbortController().signal;
        const deleteRemoteFile = async () => {
          if (!remoteName) return;

          for (
            let attempt = 1;
            attempt <= policy.cleanupAttempts;
            attempt += 1
          ) {
            try {
              await dependencies.geminiFiles.delete(remoteName, cleanupSignal);
              return;
            } catch (cause) {
              if (
                !(cause instanceof BoundaryError) ||
                !cause.retryable ||
                attempt === policy.cleanupAttempts
              ) {
                throw cause;
              }
              await dependencies.sleep(
                policy.cleanupRetryDelayMs,
                cleanupSignal,
              );
            }
          }
        };
        const cleanupResults = await Promise.allSettled([
          deleteRemoteFile(),
          dependencies.temporaryFiles.removeDirectory(directory),
        ]);
        const cleanupFailed = cleanupResults.some(
          (result) => result.status === "rejected",
        );
        if (cleanupFailed) {
          const cleanupFailure = new IngestionError({
            code: "INGESTION_CLEANUP_FAILED",
            message: "The video was processed, but cleanup did not finish.",
            retryable: false,
            offerUploadFallback: false,
          });
          try {
            dependencies.reportCleanupFailure(cleanupFailure);
          } catch {}
          if (primaryFailure === undefined) throw cleanupFailure;
        }
      }
    },
  };
}
