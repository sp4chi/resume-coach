# Resume coach

Next.js app. Upload a resume, get feedback and interview prep.

Built as a learning project. Every service has a free option, and local
development needs no account and no credit card.

## The stack

| Job | Local (free) | Production (free tier) |
|---|---|---|
| File storage | LocalStack | Cloudflare R2 |
| Database / sessions | Redis in Docker | Upstash Redis |
| PDF text | `unpdf` (in-process) | same |
| AI model | mock reply | Groq |
| Hosting | `npm run dev` | Vercel |

R2 copies the S3 API, and Upstash speaks normal Redis. So the same code runs
in both places. Only environment variables change.

## Running it

```bash
npm run services     # LocalStack + Redis in Docker
npm run setup:local  # create the bucket and its CORS rules
npm run dev          # http://localhost:3000
```

Useful while developing:

```bash
npm run inspect                    # what is really in storage and Redis
node scripts/toggle-cors.mjs break # make uploads fail, to test error handling
node scripts/toggle-cors.mjs fix   # put it back
```

The app runs with no AI key — you get a mock reply. For real answers, get a
free key at https://console.groq.com/keys and put it in `.env.local`:

```
LLM_API_KEY=gsk_...
```

## How a resume moves through the app

1. **Presign** — `/api/presign` asks storage for a temporary upload URL and
   saves a record with status `PENDING`.
2. **Upload** — the browser sends the file **straight to storage**. It never
   passes through the Next.js server, so there are no body size limits.
3. **Confirm** — `/api/uploads/confirm` runs `HeadObject` to check the file is
   really there, then sets status `READY`.
4. **Parse** — `/api/uploads/parse` pulls the text out once and caches it.
   Status becomes `PARSED`.
5. **Chat** — `/api/chat` reads the cached text. It never opens the file again.

## Why the upload code looks careful

Uploads can fail silently. The browser talks directly to storage, so a failed
upload never appears in your server logs.

Three things the client does on purpose:

1. **Checks the status code.** A 403 is a *completed* request as far as
   `fetch` and `XHR` are concerned. Code that only uses try/catch will report
   success on every rejection.
2. **Keeps the error handler anyway.** A CORS failure has **no status code at
   all**, so a status check alone cannot catch it.
3. **Asks the server to verify.** This is the only check that catches an
   upload that returns a real 200 while the database points somewhere else.

Uploads stay `PENDING` until the server confirms. The client is never trusted.

Also note `requestChecksumCalculation: "WHEN_REQUIRED"` in
`src/lib/storage.ts`. Without it, the AWS SDK signs a CRC32 header that
browsers do not send, and every presigned upload fails with a 400.

## Layout

```
src/lib/storage.ts                    storage client (LocalStack / R2 / S3)
src/lib/store.ts                      Redis: uploads, resume text, sessions
src/lib/llm.ts                        Groq streaming (OpenAI-compatible)
src/lib/keys.ts                       all storage keys built in one place
src/app/api/presign/route.ts          issues the upload URL
src/app/api/uploads/confirm/route.ts  verifies the file arrived
src/app/api/uploads/parse/route.ts    extracts text once
src/app/api/chat/route.ts             streaming chat over SSE
src/components/ResumeUpload.tsx       the upload client
```

## Sessions

Chat history lives in a Redis list with a 30 minute TTL. The TTL resets on
every message, so an active chat stays alive and an abandoned one deletes
itself. Only the last 12 turns are kept.

Resume text expires after 1 day. There is no reason to keep someone's personal
document longer than that.

## Still to do

- [ ] Chat UI (the API works; there is no page for it yet)
- [ ] Login — Clerk is the easy option
- [ ] Support .docx (needs `mammoth`)
- [ ] Deploy to Vercel with R2 + Upstash + Groq
