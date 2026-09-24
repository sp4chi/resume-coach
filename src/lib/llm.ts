// Groq uses an OpenAI-compatible API, so plain fetch is enough -- no SDK.
// To switch to OpenAI, OpenRouter or Together, change BASE and MODEL only.

const BASE = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
const MODEL = process.env.LLM_MODEL ?? "llama-3.3-70b-versatile";
const KEY = process.env.LLM_API_KEY;

export const HAS_KEY = Boolean(KEY);
export const LLM_MODEL = MODEL;

const SYSTEM = `You are a resume and interview coach for job seekers.
Be specific. Point out weak bullet points directly instead of giving praise.
When you suggest a rewrite, show the rewritten line.
Keep answers under 150 words unless asked for more.`;

export type Msg = { role: "system" | "user" | "assistant"; content: string };

export function buildMessages(resumeText: string | null, history: Msg[], userMessage: string): Msg[] {
  const system = resumeText
    ? `${SYSTEM}\n\nThe candidate's resume:\n"""\n${resumeText.slice(0, 6000)}\n"""`
    : SYSTEM;
  return [{ role: "system", content: system }, ...history, { role: "user", content: userMessage }];
}

// Yields text pieces as they arrive, so the user sees words quickly.
export async function* streamChat(messages: Msg[]): AsyncGenerator<string> {
  if (!HAS_KEY) {
    // Mock, so the app runs with no key at all.
    await new Promise((r) => setTimeout(r, 300));
    for (const w of "This is a mock reply because no LLM_API_KEY is set. Add one in .env.local to get real answers.".split(" ")) {
      await new Promise((r) => setTimeout(r, 15));
      yield w + " ";
    }
    return;
  }

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, messages, stream: true, max_tokens: 500 }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const piece = JSON.parse(data).choices?.[0]?.delta?.content;
        if (piece) yield piece;
      } catch { /* partial JSON, ignore */ }
    }
  }
}
