"use client";

import { useState } from "react";
import ResumeUpload from "./ResumeUpload";
import ChatPanel from "./ChatPanel";

type Resume = { uploadId: string; filename: string; chars: number };

export default function ResumeCoach() {
  const [resume, setResume] = useState<Resume | null>(null);
  // One session per page load. A real app would key this to the logged-in user.
  const [sessionId] = useState(() => `s-${Math.random().toString(36).slice(2, 10)}`);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {resume ? (
        // Once a resume is loaded, collapse the uploader to a single line.
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
          <span className="truncate">
            <span className="text-neutral-500">Using</span>{" "}
            <span className="font-medium">{resume.filename}</span>{" "}
            <span className="text-neutral-400">
              ({resume.chars.toLocaleString()} characters)
            </span>
          </span>
          <button
            onClick={() => setResume(null)}
            className="shrink-0 text-xs text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            change
          </button>
        </div>
      ) : (
        <ResumeUpload onReady={setResume} />
      )}

      <ChatPanel uploadId={resume?.uploadId ?? null} sessionId={sessionId} />
    </div>
  );
}
