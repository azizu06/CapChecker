import { readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createNodeTemporaryFiles,
  NodeTemporaryFileError,
} from "./node-temp-files";

describe("createNodeTemporaryFiles", () => {
  it("creates an isolated directory under the operating system temp directory and removes it", async () => {
    const temporaryFiles = createNodeTemporaryFiles();
    const directory = await temporaryFiles.createDirectory();

    expect(relative(tmpdir(), directory)).not.toMatch(/^\.\.(?:\/|\\|$)/);
    await expect(stat(directory)).resolves.toMatchObject({});
    const staged = await temporaryFiles.stageUpload({
      directory,
      fileName: "cleanup.mp4",
      bytes: new Uint8Array([1]),
      signal: new AbortController().signal,
    });

    await temporaryFiles.removeDirectory(directory);

    await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(staged.path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("stages upload bytes under their basename inside the isolated directory", async () => {
    const temporaryFiles = createNodeTemporaryFiles();
    const directory = await temporaryFiles.createDirectory();

    try {
      const bytes = new Uint8Array([0, 1, 2, 255]);
      const staged = await temporaryFiles.stageUpload({
        directory,
        fileName: "clip.webm",
        bytes,
        signal: new AbortController().signal,
      });

      expect(staged.fileName).toBe("clip.webm");
      expect(relative(directory, staged.path)).toBe("clip.webm");
      await expect(readFile(staged.path)).resolves.toEqual(Buffer.from(bytes));
    } finally {
      await temporaryFiles.removeDirectory(directory);
    }
  });

  it("rejects a path-traversing upload name with a safe typed error", async () => {
    const temporaryFiles = createNodeTemporaryFiles();
    const directory = await temporaryFiles.createDirectory();
    const fileName = `../escaped-${basename(directory)}.webm`;
    const escapedPath = join(directory, fileName);

    try {
      const result = temporaryFiles.stageUpload({
        directory,
        fileName,
        bytes: new Uint8Array([1]),
        signal: new AbortController().signal,
      });

      await expect(result).rejects.toEqual(
        new NodeTemporaryFileError("INVALID_UPLOAD_FILENAME"),
      );
      await expect(stat(escapedPath)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(result).rejects.not.toThrow(directory);
      await expect(result).rejects.not.toThrow(fileName);
    } finally {
      await rm(escapedPath, { force: true });
      await temporaryFiles.removeDirectory(directory);
    }
  });

  it.each(["nested/clip.mp4", "..\\clip.mp4", "C:\\clip.mp4"])(
    "rejects non-basename upload name %s on every platform",
    async (fileName) => {
      const temporaryFiles = createNodeTemporaryFiles();
      const directory = await temporaryFiles.createDirectory();

      try {
        const result = temporaryFiles.stageUpload({
          directory,
          fileName,
          bytes: new Uint8Array([1]),
          signal: new AbortController().signal,
        });

        await expect(result).rejects.toEqual(
          new NodeTemporaryFileError("INVALID_UPLOAD_FILENAME"),
        );
      } finally {
        await temporaryFiles.removeDirectory(directory);
      }
    },
  );

  it("honors a pre-aborted signal before writing upload bytes", async () => {
    const temporaryFiles = createNodeTemporaryFiles();
    const directory = await temporaryFiles.createDirectory();
    const controller = new AbortController();
    controller.abort(new Error(`cancelled near ${directory}`));

    try {
      const result = temporaryFiles.stageUpload({
        directory,
        fileName: "cancelled.mp4",
        bytes: new Uint8Array([1, 2, 3]),
        signal: controller.signal,
      });

      await expect(result).rejects.toEqual(
        new NodeTemporaryFileError("UPLOAD_STAGING_ABORTED"),
      );
      await expect(stat(join(directory, "cancelled.mp4"))).rejects.toMatchObject(
        { code: "ENOENT" },
      );
      await expect(result).rejects.not.toThrow(directory);
    } finally {
      await temporaryFiles.removeDirectory(directory);
    }
  });

  it("turns filesystem staging failures into a path-free typed error", async () => {
    const temporaryFiles = createNodeTemporaryFiles();
    const missingDirectory = join(
      tmpdir(),
      `capcheck-missing-${crypto.randomUUID()}`,
    );

    const result = temporaryFiles.stageUpload({
      directory: missingDirectory,
      fileName: "clip.mp4",
      bytes: new Uint8Array([1]),
      signal: new AbortController().signal,
    });

    await expect(result).rejects.toEqual(
      new NodeTemporaryFileError("UPLOAD_STAGING_FAILED"),
    );
    await expect(result).rejects.not.toThrow(missingDirectory);
  });

  it("turns cleanup failures into a path-free typed error", async () => {
    const temporaryFiles = createNodeTemporaryFiles();
    const invalidDirectory = `private\0${tmpdir()}`;
    const result = temporaryFiles.removeDirectory(invalidDirectory);

    await expect(result).rejects.toEqual(
      new NodeTemporaryFileError("TEMP_DIRECTORY_CLEANUP_FAILED"),
    );
    await expect(result).rejects.not.toThrow(tmpdir());
  });
});
