import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix, win32 } from "node:path";

import type { VideoIngestionDependencies } from "./video-ingestion";

export type NodeTemporaryFileErrorCode =
  | "INVALID_UPLOAD_FILENAME"
  | "TEMP_DIRECTORY_CLEANUP_FAILED"
  | "TEMP_DIRECTORY_CREATION_FAILED"
  | "UPLOAD_STAGING_ABORTED"
  | "UPLOAD_STAGING_FAILED";

const SAFE_MESSAGES: Record<NodeTemporaryFileErrorCode, string> = {
  INVALID_UPLOAD_FILENAME: "The upload filename is invalid.",
  TEMP_DIRECTORY_CLEANUP_FAILED: "Temporary upload cleanup failed.",
  TEMP_DIRECTORY_CREATION_FAILED:
    "A temporary upload directory could not be created.",
  UPLOAD_STAGING_ABORTED: "Upload staging was cancelled.",
  UPLOAD_STAGING_FAILED: "The upload could not be staged.",
};

export class NodeTemporaryFileError extends Error {
  readonly code: NodeTemporaryFileErrorCode;

  constructor(code: NodeTemporaryFileErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = "NodeTemporaryFileError";
    this.code = code;
  }
}

function isBasename(fileName: string): boolean {
  return (
    fileName.length > 0 &&
    fileName !== "." &&
    fileName !== ".." &&
    !fileName.includes("\0") &&
    posix.basename(fileName) === fileName &&
    win32.basename(fileName) === fileName
  );
}

export function createNodeTemporaryFiles(): VideoIngestionDependencies["temporaryFiles"] {
  return {
    createDirectory: async () => {
      try {
        return await mkdtemp(join(tmpdir(), "capcheck-"));
      } catch {
        throw new NodeTemporaryFileError("TEMP_DIRECTORY_CREATION_FAILED");
      }
    },
    stageUpload: async ({ directory, fileName, bytes, signal }) => {
      if (signal.aborted) {
        throw new NodeTemporaryFileError("UPLOAD_STAGING_ABORTED");
      }
      if (!isBasename(fileName)) {
        throw new NodeTemporaryFileError("INVALID_UPLOAD_FILENAME");
      }
      const path = join(directory, fileName);
      try {
        await writeFile(path, bytes, { flag: "wx", signal });
      } catch {
        throw new NodeTemporaryFileError(
          signal.aborted ? "UPLOAD_STAGING_ABORTED" : "UPLOAD_STAGING_FAILED",
        );
      }
      return { path, fileName };
    },
    removeDirectory: async (directory) => {
      try {
        await rm(directory, { force: true, recursive: true });
      } catch {
        throw new NodeTemporaryFileError("TEMP_DIRECTORY_CLEANUP_FAILED");
      }
    },
  };
}
