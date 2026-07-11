import { createGeminiFilesClient } from "./gemini-files";
import { detectVideoMimeType } from "./media-type";
import { createNodeTemporaryFiles } from "./node-temp-files";
import {
  createVideoIngestor,
  type VideoIngestionPolicy,
} from "./video-ingestion";
import { createYtDlpDownloader, type ProcessRunner } from "./yt-dlp";

type NodeVideoIngestorOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  policy?: VideoIngestionPolicy;
  ytDlpExecutable?: string;
  ytDlpRun?: ProcessRunner;
};

const abortableSleep = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }

    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      finish();
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      finish();
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });

export function createNodeVideoIngestor({
  apiKey,
  fetch,
  policy,
  ytDlpExecutable,
  ytDlpRun,
}: NodeVideoIngestorOptions) {
  return createVideoIngestor(
    {
      temporaryFiles: createNodeTemporaryFiles(),
      ytDlp: createYtDlpDownloader({
        executable: ytDlpExecutable,
        run: ytDlpRun,
      }),
      mime: { detect: detectVideoMimeType },
      geminiFiles: createGeminiFilesClient({ apiKey, fetch }),
      now: Date.now,
      sleep: abortableSleep,
    },
    policy,
  );
}
