import { FileVideo, Link2, RotateCcw, Upload, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import type { ErrorEvent } from "@/domain/analysis";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const allowedUploadTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const allowedExtensions = new Set(["mp4", "mov", "webm"]);

export const validateUpload = (file: File): string => {
  if (file.size === 0) return "The selected video cannot be empty.";
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!allowedUploadTypes.has(file.type) || !allowedExtensions.has(extension)) {
    return "Choose an MP4, MOV, or WebM video file.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "Choose a video that is 50 MB or smaller.";
  }
  return "";
};

export const validateSubmission = (url: string, file: File | null): string => {
  if (file) return validateUpload(file);
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return "";
  } catch {
    // The shared actionable message covers missing and malformed values.
  }
  return "Enter a valid HTTP or HTTPS video URL.";
};

type Props = {
  url: string;
  file: File | null;
  loading: boolean;
  error: ErrorEvent["error"] | null;
  validation: string;
  onUrlChange(value: string): void;
  onFileChange(file: File | null): void;
  onSubmit(): void;
  onRetry(): void;
  onReset(): void;
};

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function IntakePanel({
  url,
  file,
  loading,
  error,
  validation,
  onUrlChange,
  onFileChange,
  onSubmit,
  onRetry,
  onReset,
}: Props) {
  const inputId = useId();
  const fileId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadValidation, setUploadValidation] = useState("");

  useEffect(() => {
    if (!file && fileInputRef.current) fileInputRef.current.value = "";
  }, [file]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.currentTarget.files?.[0];
    if (!selected) return;
    const message = validateUpload(selected);
    if (message) {
      onFileChange(null);
      setUploadValidation(message);
      event.currentTarget.value = "";
      return;
    }
    setUploadValidation("");
    onFileChange(selected);
  };

  const describedBy = `${inputId}-help${validation ? ` ${inputId}-error` : ""}`;
  const fileDescribedBy = `${fileId}-help${uploadValidation ? ` ${fileId}-error` : ""}`;

  const removeFile = () => {
    onFileChange(null);
    setUploadValidation("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <section className="intake-panel panel" aria-labelledby="intake-title">
      <div className="panel-heading">
        <div>
          <p className="step-label">Start a check</p>
          <h2 id="intake-title">Analyze a financial video</h2>
        </div>
        <Link2 aria-hidden="true" />
      </div>
      <form onSubmit={submit} noValidate>
        <label htmlFor={inputId}>Video URL</label>
        <div className="url-row">
          <input
            id={inputId}
            type="url"
            value={url}
            disabled={loading || Boolean(file)}
            aria-invalid={Boolean(validation)}
            aria-describedby={describedBy}
            placeholder="https://youtube.com/shorts/..."
            onChange={(event) => onUrlChange(event.target.value)}
          />
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Analyzing…" : "Analyze video"}
          </button>
        </div>
        <p id={`${inputId}-help`} className="helper">
          YouTube Shorts and TikTok links using HTTP or HTTPS.
        </p>
        {validation && (
          <p id={`${inputId}-error`} className="field-error" role="alert">
            {validation}
          </p>
        )}

        <div className="divider"><span>or upload a video</span></div>
        <label
          className={`drop-zone${file ? " selected" : ""}${loading ? " disabled" : ""}`}
          htmlFor={fileId}
          aria-disabled={loading}
        >
          <Upload aria-hidden="true" />
          <span>
            <strong>{file ? "Video ready" : "Choose a video file"}</strong>
            <small id={`${fileId}-help`}>MP4, MOV, or WebM · up to 50 MB</small>
          </span>
          <input
            id={fileId}
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            disabled={loading}
            aria-invalid={Boolean(uploadValidation)}
            aria-describedby={fileDescribedBy}
            onChange={selectFile}
          />
        </label>
        {uploadValidation && (
          <p id={`${fileId}-error`} className="field-error" role="alert">
            {uploadValidation}
          </p>
        )}
        {file && (
          <div className="selected-file">
            <FileVideo aria-hidden="true" />
            <span><strong>{file.name}</strong><small>{formatSize(file.size)} · ready</small></span>
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              disabled={loading}
              onClick={removeFile}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        )}
      </form>
      {error && (
        <div className="error-banner" role="alert">
          <div><strong>Analysis stopped</strong><p>{error.message}</p></div>
          <div className="error-actions">
            {error.retryable && <button type="button" onClick={onRetry}>Retry</button>}
            <button type="button" onClick={onReset}><RotateCcw aria-hidden="true" />Reset</button>
          </div>
        </div>
      )}
    </section>
  );
}
