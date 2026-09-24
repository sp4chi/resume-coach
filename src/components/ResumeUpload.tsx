"use client";

import { useState } from "react";

type Phase =
  | "idle"
  | "presigning"
  | "uploading"
  | "confirming"
  | "parsing"
  | "done"
  | "error";

type Props = {
  onReady: (info: { uploadId: string; filename: string; chars: number }) => void;
};

export default function ResumeUpload({ onReady }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState("");

  async function handleFile(file: File) {
    setDetail("");
    setProgress(0);

    try {
      // 1. Ask our server for a URL. The server picks the key, not us.
      setPhase("presigning");
      const pres = await fetch("/api/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });
      if (!pres.ok) throw new Error((await pres.json()).error ?? "presign failed");
      const { uploadId, url } = await pres.json();

      // 2. PUT straight to storage. XHR instead of fetch, only for progress.
      setPhase("uploading");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        // Must match the Content-Type that was signed, or the signature fails.
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) =>
          e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        // A non-2xx is NOT an error to XHR, so check the status ourselves.
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Storage returned ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
        // Fires for CORS failures, which carry no status code at all.
        xhr.onerror = () =>
          reject(new Error("Network or CORS failure — the request never completed."));
        xhr.ontimeout = () => reject(new Error("Upload timed out."));
        xhr.send(file);
      });

      // 3. Ask the server to check it really landed.
      setPhase("confirming");
      const conf = await fetch("/api/uploads/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });
      const confJson = await conf.json();
      if (!conf.ok || !confJson.confirmed) {
        throw new Error(confJson.message ?? "server could not verify the upload");
      }

      // 4. Pull the text out once, so chat never re-reads the file.
      setPhase("parsing");
      const parse = await fetch("/api/uploads/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });
      const parseJson = await parse.json();
      if (!parse.ok || !parseJson.parsed) {
        throw new Error(parseJson.error ?? "could not read the text");
      }

      setPhase("done");
      setDetail(`${file.name} — ${parseJson.chars.toLocaleString()} characters read`);
      onReady({ uploadId, filename: file.name, chars: parseJson.chars });
    } catch (err) {
      setPhase("error");
      setDetail(err instanceof Error ? err.message : String(err));
    }
  }

  const label: Record<Phase, string> = {
    idle: "Choose a resume — PDF or TXT, up to 10MB",
    presigning: "Getting an upload link…",
    uploading: `Uploading… ${progress}%`,
    confirming: "Checking it arrived…",
    parsing: "Reading the text…",
    done: "Ready",
    error: "Upload failed",
  };

  const busy = ["presigning", "uploading", "confirming", "parsing"].includes(phase);

  return (
    <div className="space-y-3">
      <label
        className={`block rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          busy
            ? "cursor-wait border-neutral-300 dark:border-neutral-700"
            : "cursor-pointer border-neutral-300 hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
        }`}
      >
        <input
          type="file"
          className="hidden"
          accept=".pdf,.txt"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <span className="text-sm text-neutral-600 dark:text-neutral-400">{label[phase]}</span>
      </label>

      {phase === "uploading" && (
        <div className="h-1 w-full overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {detail && (
        <p
          className={`text-sm ${
            phase === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-green-700 dark:text-green-400"
          }`}
        >
          {detail}
        </p>
      )}
    </div>
  );
}
