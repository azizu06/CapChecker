import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";

import { BoundaryError, type VideoIngestionDependencies } from "./video-ingestion";

type FileSizeReader = (filePath: string) => Promise<number>;

type ProcessResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

type ProcessRequest = {
  executable: string;
  args: Array<string>;
  cwd: string;
  shell: false;
  signal: AbortSignal;
};

export type ProcessRunner = (request: ProcessRequest) => Promise<ProcessResult>;

type YtDlpDownloaderOptions = {
  executable?: string;
  maxFileSize?: string;
  run?: ProcessRunner;
  fileSize?: FileSizeReader;
};

const statFileSize: FileSizeReader = async (filePath) =>
  (await stat(filePath)).size;

const runProcess: ProcessRunner = ({
  executable,
  args,
  cwd,
  shell,
  signal,
}) =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      shell,
      signal,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });

export function createYtDlpDownloader({
  executable = "yt-dlp",
  maxFileSize = "50M",
  run = runProcess,
  fileSize = statFileSize,
}: YtDlpDownloaderOptions = {}): VideoIngestionDependencies["ytDlp"] {
  return {
    async download({ url, directory, signal }) {
      let result: ProcessResult;
      try {
        result = await run({
          executable,
          args: [
            "--no-playlist",
            "--max-filesize",
            maxFileSize,
            "--restrict-filenames",
            "--output",
            path.join(directory, "%(id)s.%(ext)s"),
            "--print",
            "after_move:filepath",
            "--",
            url,
          ],
          cwd: directory,
          shell: false,
          signal,
        });
      } catch (cause) {
        if (signal.aborted) throw cause;
        throw new BoundaryError("yt-dlp is unavailable on this server.", false);
      }

      if (result.exitCode !== 0) {
        throw new BoundaryError("yt-dlp could not download this video.", false);
      }

      const reportedPath = result.stdout
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .at(-1);
      const root = path.resolve(directory);
      const downloadedPath = reportedPath
        ? path.resolve(directory, reportedPath)
        : root;
      const relativePath = path.relative(root, downloadedPath);
      if (
        !reportedPath ||
        !relativePath ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
      ) {
        throw new BoundaryError(
          "yt-dlp returned an unsafe output path.",
          false,
        );
      }

      return {
        path: downloadedPath,
        fileName: path.basename(downloadedPath),
        size: await fileSize(downloadedPath),
      };
    },
  };
}
