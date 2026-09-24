"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

// The model replies in markdown. Without this the user sees raw ** and ###.
// Each element gets its own classes so spacing stays tight inside a chat bubble.
const markdownComponents = {
  h1: (p: React.ComponentProps<"h1">) => <h3 className="mt-3 mb-1 font-semibold first:mt-0" {...p} />,
  h2: (p: React.ComponentProps<"h2">) => <h3 className="mt-3 mb-1 font-semibold first:mt-0" {...p} />,
  h3: (p: React.ComponentProps<"h3">) => <h3 className="mt-3 mb-1 font-semibold first:mt-0" {...p} />,
  p: (p: React.ComponentProps<"p">) => <p className="my-1.5 first:mt-0 last:mb-0" {...p} />,
  ul: (p: React.ComponentProps<"ul">) => <ul className="my-1.5 list-disc space-y-1 pl-5" {...p} />,
  ol: (p: React.ComponentProps<"ol">) => <ol className="my-1.5 list-decimal space-y-1 pl-5" {...p} />,
  li: (p: React.ComponentProps<"li">) => <li className="marker:text-neutral-400" {...p} />,
  strong: (p: React.ComponentProps<"strong">) => <strong className="font-semibold" {...p} />,
  code: (p: React.ComponentProps<"code">) => (
    <code
      className="rounded bg-neutral-200 px-1 py-0.5 text-[12px] dark:bg-neutral-800"
      {...p}
    />
  ),
  pre: (p: React.ComponentProps<"pre">) => (
    <pre
      className="my-2 overflow-x-auto rounded bg-neutral-200 p-2 text-[12px] dark:bg-neutral-800"
      {...p}
    />
  ),
  a: (p: React.ComponentProps<"a">) => (
    <a className="underline" target="_blank" rel="noreferrer" {...p} />
  ),
  hr: () => <hr className="my-3 border-neutral-200 dark:border-neutral-800" />,
};

type Message = {
  role: "user" | "assistant";
  content: string;
  ttft?: number | null;
  total?: number;
  failed?: boolean;
};

type Props = {
  uploadId: string | null;
  sessionId: string;
};

const SUGGESTIONS = [
  "How can I make my project bullets stronger?",
  "What questions should I expect for a backend intern role?",
  "Is my resume too project-heavy with no internship experience?",
  "What should I cut to get this to one page?",
];

export default function ChatPanel({ uploadId, sessionId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as tokens stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);

    // Helper: update only the last message (the one being streamed into).
    const patchLast = (patch: Partial<Message>) =>
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { ...next[next.length - 1], ...patch };
        return next;
      });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId, uploadId }),
      });
      if (!res.ok || !res.body) throw new Error(`server returned ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE blocks are separated by a blank line.
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const lines = block.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event: "));
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const raw = dataLine.slice(6);
          const event = eventLine?.slice(7);

          if (event === "ttft") {
            patchLast({ ttft: Number(raw) });
          } else if (event === "done") {
            const { total } = JSON.parse(raw);
            patchLast({ total });
          } else if (event === "error") {
            patchLast({ content: JSON.parse(raw), failed: true });
          } else {
            text += JSON.parse(raw);
            patchLast({ content: text });
          }
        }
      }
    } catch (err) {
      patchLast({
        content: err instanceof Error ? err.message : "Something went wrong.",
        failed: true,
      });
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(uploadId);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        ref={scrollRef}
        className="min-h-75 flex-1 space-y-4 overflow-y-auto rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
      >
        {messages.length === 0 && (
          <div className="space-y-3 py-6 text-center">
            <p className="text-sm text-neutral-500">
              {ready
                ? "Ask anything about your resume."
                : "Upload a resume first, then ask a question."}
            </p>
            {ready && (
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className="max-w-[85%] space-y-1">
              <div
                className={`rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "whitespace-pre-wrap bg-blue-600 text-white"
                    : m.failed
                      ? "whitespace-pre-wrap border border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                      : "border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
                }`}
              >
                {!m.content ? (
                  <span className="text-neutral-400">thinking…</span>
                ) : m.role === "assistant" && !m.failed ? (
                  <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {m.content}
                  </Markdown>
                ) : (
                  m.content
                )}
              </div>
              {m.role === "assistant" && m.ttft != null && (
                <p className="text-[11px] text-neutral-400">
                  first word in {m.ttft}ms
                  {m.total != null && ` · finished in ${m.total}ms`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!ready || busy}
          placeholder={ready ? "Ask a question…" : "Upload a resume to start"}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button
          type="submit"
          disabled={!ready || busy || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </section>
  );
}
