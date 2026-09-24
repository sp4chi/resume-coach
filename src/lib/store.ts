import Redis from "ioredis";

// One Redis client for both local Docker and Upstash.
// Upstash speaks the normal Redis protocol, so ioredis works for both --
// you only change REDIS_URL.
//
// Next.js hot-reloads modules in dev, which would otherwise open a new
// connection on every reload. Cache it on globalThis.
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// ---------------------------------------------------------------- uploads --
export type UploadStatus = "PENDING" | "READY" | "PARSED";

export type UploadRecord = {
  uploadId: string;
  userId: string;
  key: string;
  filename: string;
  contentType: string;
  status: UploadStatus;
  createdAt: string;
  sizeBytes?: number;
  confirmedAt?: string;
  textChars?: number;
};

const uploadKey = (userId: string, uploadId: string) => `upload:${userId}:${uploadId}`;
const textKey = (userId: string, uploadId: string) => `text:${userId}:${uploadId}`;

const UPLOAD_TTL = 60 * 60 * 24; // resumes expire after 1 day

export async function putUpload(rec: UploadRecord) {
  await redis.set(uploadKey(rec.userId, rec.uploadId), JSON.stringify(rec), "EX", UPLOAD_TTL);
}

export async function getUpload(userId: string, uploadId: string): Promise<UploadRecord | null> {
  const raw = await redis.get(uploadKey(userId, uploadId));
  return raw ? (JSON.parse(raw) as UploadRecord) : null;
}

export async function patchUpload(userId: string, uploadId: string, patch: Partial<UploadRecord>) {
  const cur = await getUpload(userId, uploadId);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  await putUpload(next);
  return next;
}

// Extracted resume text is stored once and read on every chat turn.
export async function putResumeText(userId: string, uploadId: string, text: string) {
  await redis.set(textKey(userId, uploadId), text, "EX", UPLOAD_TTL);
}
export async function getResumeText(userId: string, uploadId: string) {
  return redis.get(textKey(userId, uploadId));
}

// --------------------------------------------------------------- sessions --
export type Turn = { role: "user" | "assistant"; content: string };

const sessionKey = (userId: string, sessionId: string) => `session:${userId}:${sessionId}`;
const SESSION_TTL = 60 * 30;  // 30 minutes of inactivity
const KEEP_TURNS = 12;        // keep the most recent turns

export async function appendTurn(userId: string, sessionId: string, turn: Turn) {
  const k = sessionKey(userId, sessionId);
  await redis.rpush(k, JSON.stringify(turn));
  await redis.ltrim(k, -KEEP_TURNS, -1);
  await redis.expire(k, SESSION_TTL); // TTL resets on every message
}

export async function getTurns(userId: string, sessionId: string): Promise<Turn[]> {
  const raw = await redis.lrange(sessionKey(userId, sessionId), 0, -1);
  return raw.map((r) => JSON.parse(r) as Turn);
}
