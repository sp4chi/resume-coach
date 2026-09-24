import { NextRequest } from "next/server";
import { getResumeText, getTurns, appendTurn } from "@/lib/store";
import { buildMessages, streamChat } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const {
    message,
    sessionId = "default",
    uploadId,
    userId = "demo-user",
  } = await req.json();

  if (!message) return new Response("message required", { status: 400 });

  // Read the cached text. The PDF is never opened here.
  const resumeText = uploadId ? await getResumeText(userId, uploadId) : null;
  const history = await getTurns(userId, sessionId);
  const messages = buildMessages(resumeText, history, message);

  await appendTurn(userId, sessionId, { role: "user", content: message });

  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      let firstTokenMs: number | null = null;
      try {
        for await (const piece of streamChat(messages)) {
          if (firstTokenMs === null) {
            firstTokenMs = Date.now() - started;
            controller.enqueue(encoder.encode(`event: ttft\ndata: ${firstTokenMs}\n\n`));
          }
          full += piece;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(piece)}\n\n`));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream failed";
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(msg)}\n\n`));
      }

      if (full) await appendTurn(userId, sessionId, { role: "assistant", content: full });

      controller.enqueue(
        encoder.encode(
          `event: done\ndata: ${JSON.stringify({ ttft: firstTokenMs, total: Date.now() - started })}\n\n`
        )
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
