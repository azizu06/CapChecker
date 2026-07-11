import { FileVideo, Link2, RotateCcw, Upload, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import type { ErrorEvent } from "@/domain/analysis";

type Props = { url: string; file: File | null; loading: boolean; error: ErrorEvent["error"] | null; onUrlChange(value: string): void; onFileChange(file: File | null): void; onSubmit(): void; onRetry(): void; onReset(): void };
const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function IntakePanel({ url, file, loading, error, onUrlChange, onFileChange, onSubmit, onRetry, onReset }: Props) {
  const [validation, setValidation] = useState("");
  const inputId = useId(); const fileId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      let valid = false;
      try { const parsed = new URL(url); valid = parsed.protocol === "http:" || parsed.protocol === "https:"; } catch { /* invalid */ }
      if (!valid) { setValidation("Enter a valid HTTP or HTTPS video URL."); return; }
    }
    setValidation(""); onSubmit();
  };
  return <section className="intake-panel panel" aria-labelledby="intake-title">
    <div className="panel-heading"><div><p className="step-label">Start a check</p><h2 id="intake-title">Analyze a financial video</h2></div><Link2 aria-hidden="true" /></div>
    <form onSubmit={submit} noValidate>
      <label htmlFor={inputId}>Video URL</label><div className="url-row"><input id={inputId} type="url" value={url} disabled={loading || Boolean(file)} aria-invalid={Boolean(validation)} aria-describedby={`${inputId}-help ${inputId}-error`} placeholder="https://youtube.com/shorts/..." onChange={(event) => { onUrlChange(event.target.value); setValidation(""); }} /><button className="primary-button" type="submit" disabled={loading}>{loading ? "Analyzing…" : "Analyze video"}</button></div>
      <p id={`${inputId}-help`} className="helper">YouTube Shorts and TikTok links using HTTP or HTTPS.</p>{validation && <p id={`${inputId}-error`} className="field-error" role="alert">{validation}</p>}
      <div className="divider"><span>or upload a video</span></div>
      <label className={`drop-zone${file ? " selected" : ""}`} htmlFor={fileId}><Upload aria-hidden="true" /><span><strong>{file ? "Video ready" : "Choose a video file"}</strong><small>MP4, MOV, or WebM · up to 50 MB</small></span><input id={fileId} className="visually-hidden" type="file" accept="video/mp4,video/quicktime,video/webm" disabled={loading} onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} /></label>
      {file && <div className="selected-file"><FileVideo aria-hidden="true" /><span><strong>{file.name}</strong><small>{formatSize(file.size)} · ready</small></span><button type="button" aria-label={`Remove ${file.name}`} disabled={loading} onClick={() => onFileChange(null)}><X aria-hidden="true" /></button></div>}
    </form>
    {error && <div className="error-banner" role="alert"><div><strong>Analysis stopped</strong><p>{error.message}</p></div><div className="error-actions">{error.retryable && <button type="button" onClick={onRetry}>Retry</button>}<button type="button" onClick={onReset}><RotateCcw aria-hidden="true" />Reset</button></div></div>}
  </section>;
}
