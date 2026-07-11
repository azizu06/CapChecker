import { open } from "node:fs/promises";
import { extname } from "node:path";

export type DetectedVideoMimeType =
  | "video/mp4"
  | "video/quicktime"
  | "video/webm";

export type VideoMediaTypeErrorCode =
  | "UNSUPPORTED_VIDEO_FORMAT"
  | "VIDEO_TYPE_MISMATCH";

const SAFE_MESSAGES: Record<VideoMediaTypeErrorCode, string> = {
  UNSUPPORTED_VIDEO_FORMAT:
    "This video format is not supported. Upload an MP4, MOV, or WebM video.",
  VIDEO_TYPE_MISMATCH:
    "The file contents do not match its file type. Upload an MP4, MOV, or WebM video.",
};

export class VideoMediaTypeError extends Error {
  readonly code: VideoMediaTypeErrorCode;

  constructor(code: VideoMediaTypeErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = "VideoMediaTypeError";
    this.code = code;
  }
}

const MIME_TYPES = new Set<DetectedVideoMimeType>([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const EXTENSION_TYPES: Record<string, DetectedVideoMimeType> = {
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const MP4_BRANDS = new Set([
  "M4V ",
  "MSNV",
  "avc1",
  "dash",
  "iso2",
  "isom",
  "mp41",
  "mp42",
]);

function hasWebMDocType(header: Buffer): boolean {
  for (let index = 4; index < header.length - 3; index += 1) {
    if (header[index] !== 0x42 || header[index + 1] !== 0x82) continue;

    const encodedLength = header[index + 2];
    if (encodedLength === undefined) return false;

    let lengthBytes = 1;
    let marker = 0x80;
    while (lengthBytes <= 8 && (encodedLength & marker) === 0) {
      lengthBytes += 1;
      marker >>= 1;
    }
    if (lengthBytes > 8 || index + 2 + lengthBytes > header.length) {
      return false;
    }

    let valueLength = encodedLength & (marker - 1);
    for (let offset = 1; offset < lengthBytes; offset += 1) {
      valueLength = valueLength * 256 + (header[index + 2 + offset] ?? 0);
    }

    const valueStart = index + 2 + lengthBytes;
    const valueEnd = valueStart + valueLength;
    return (
      valueEnd <= header.length &&
      header.toString("ascii", valueStart, valueEnd).toLowerCase() === "webm"
    );
  }

  return false;
}

function normalizeDeclaredType(
  declaredType: string | undefined,
): DetectedVideoMimeType | undefined {
  if (declaredType === undefined) return undefined;

  const normalized = declaredType.split(";", 1)[0]?.trim().toLowerCase();
  return MIME_TYPES.has(normalized as DetectedVideoMimeType)
    ? (normalized as DetectedVideoMimeType)
    : undefined;
}

function detectFromSignature(header: Buffer): DetectedVideoMimeType | undefined {
  if (header.toString("ascii", 4, 8) === "ftyp") {
    const brand = header.toString("ascii", 8, 12);
    if (brand === "qt  ") return "video/quicktime";
    if (MP4_BRANDS.has(brand)) return "video/mp4";
  }

  const hasEbmlSignature =
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3;

  if (hasEbmlSignature && hasWebMDocType(header)) {
    return "video/webm";
  }

  return undefined;
}

export async function detectVideoMimeType(
  path: string,
  declaredType?: string,
): Promise<DetectedVideoMimeType> {
  const handle = await open(path, "r");
  const buffer = Buffer.alloc(4_096);
  let bytesRead = 0;

  try {
    ({ bytesRead } = await handle.read(buffer, 0, buffer.length, 0));
  } finally {
    await handle.close();
  }

  const signatureType = detectFromSignature(buffer.subarray(0, bytesRead));
  const extensionType = EXTENSION_TYPES[extname(path).toLowerCase()];
  const declaredMimeType = normalizeDeclaredType(declaredType);

  if (!signatureType || !extensionType || (declaredType && !declaredMimeType)) {
    throw new VideoMediaTypeError("UNSUPPORTED_VIDEO_FORMAT");
  }

  if (
    signatureType !== extensionType ||
    (declaredMimeType !== undefined && signatureType !== declaredMimeType)
  ) {
    throw new VideoMediaTypeError("VIDEO_TYPE_MISMATCH");
  }

  return signatureType;
}
