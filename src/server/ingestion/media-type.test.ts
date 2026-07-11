import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { detectVideoMimeType, VideoMediaTypeError } from "./media-type";

const temporaryDirectories: string[] = [];

async function stageFile(fileName: string, bytes: Uint8Array) {
  const directory = await mkdtemp(join(tmpdir(), "capcheck-media-type-"));
  temporaryDirectories.push(directory);
  const path = join(directory, fileName);
  await writeFile(path, bytes);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

describe("detectVideoMimeType", () => {
  it("recognizes MP4 content and normalizes a declared MIME with parameters", async () => {
    const path = await stageFile(
      "SHORT.MP4",
      Uint8Array.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f,
        0x6d, 0x00, 0x00, 0x02, 0x00,
      ]),
    );

    await expect(
      detectVideoMimeType(path, " Video/MP4; codecs=avc1 "),
    ).resolves.toBe("video/mp4");
  });

  it("recognizes QuickTime content from its signature and MOV extension", async () => {
    const path = await stageFile(
      "clip.mov",
      Uint8Array.from([
        0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20,
        0x20, 0x00, 0x00, 0x00, 0x00,
      ]),
    );

    await expect(detectVideoMimeType(path)).resolves.toBe("video/quicktime");
  });

  it("recognizes a WebM EBML header without treating every Matroska file as WebM", async () => {
    const path = await stageFile(
      "clip.webm",
      Uint8Array.from([
        0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0x82,
        0x84, 0x77, 0x65, 0x62, 0x6d,
      ]),
    );

    await expect(detectVideoMimeType(path, "video/webm")).resolves.toBe(
      "video/webm",
    );
  });

  it("rejects a declared MIME that conflicts with the file content using a safe typed error", async () => {
    const path = await stageFile(
      "customer-secret.mp4",
      Uint8Array.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f,
        0x6d, 0x00, 0x00, 0x02, 0x00,
      ]),
    );

    const error = await detectVideoMimeType(path, "video/webm").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(VideoMediaTypeError);
    expect(error).toMatchObject({
      code: "VIDEO_TYPE_MISMATCH",
      message:
        "The file contents do not match its file type. Upload an MP4, MOV, or WebM video.",
    });
    expect(String(error)).not.toContain("customer-secret");
  });

  it("rejects unsupported EBML content even if later bytes happen to contain the word webm", async () => {
    const path = await stageFile(
      "not-really-webm.webm",
      Uint8Array.from([
        0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x88, 0x6d, 0x61, 0x74,
        0x72, 0x6f, 0x73, 0x6b, 0x61, 0x00, 0x77, 0x65, 0x62, 0x6d,
      ]),
    );

    await expect(detectVideoMimeType(path, "video/webm")).rejects.toMatchObject(
      {
        name: "VideoMediaTypeError",
        code: "UNSUPPORTED_VIDEO_FORMAT",
        message:
          "This video format is not supported. Upload an MP4, MOV, or WebM video.",
      },
    );
  });
});
