"use client";

import { useState } from "react";

type Phase = "idle" | "presigning" | "uploading" | "confirming" | "done" | "error";

export default function ResumeUpload() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [detail, setDetail] = useState<string>("");

  async function handleFile(file: File) {
    setDetail("");
    setProgress(0);

    try {
      // 1. Ask our server for a URL. The server records the key; we never choose it.
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

      // 2. PUT straight to S3. XHR rather than fetch, purely for upload progress.
      setPhase("uploading");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        // Must match the Content-Type that was signed, or the signature fails.
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) =>
          e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        // Non-2xx is NOT an error to XHR either -- we check status explicitly.
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`S3 returned ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
        // Fires for CORS failures, which have no status code at all.
        xhr.onerror = () =>
          reject(new Error("Network or CORS failure — the request never completed."));
        xhr.ontimeout = () => reject(new Error("Upload timed out."));
        xhr.send(file);
      });

      // 3. Ask the server to verify it actually landed. This is the only check
      //    that catches a 200 where the object ended up somewhere unexpected.
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

      setPhase("done");
      setDetail(`${(confJson.sizeBytes / 1024).toFixed(1)} KB stored and verified`);
    } catch (err) {
      setPhase("error");
      setDetail(err instanceof Error ? err.message : String(err));
    }
  }

  const label: Record<Phase, string> = {
    idle: "Choose a resume (PDF, DOCX or TXT, max 10MB)",
    presigning: "Requesting upload URL…",
    uploading: `Uploading… ${progress}%`,
    confirming: "Verifying with the server…",
    done: "Upload verified",
    error: "Upload failed",
  };

  return (
    <div className="w-full max-w-lg space-y-4">
      <label className="block cursor-pointer rounded-lg border-2 border-dashed border-neutral-300 p-8 text-center hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500">
        <input
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <span className="text-sm text-neutral-600 dark:text-neutral-400">{label[phase]}</span>
      </label>

      {phase === "uploading" && (
        <div className="h-1.5 w-full overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {detail && (
        <p
          className={`text-sm ${
            phase === "error" ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"
          }`}
        >
          {detail}
        </p>
      )}
    </div>
  );
}
