import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { s3, BUCKET } from "@/lib/storage";
import { putUpload } from "@/lib/store";
import { resumeKey } from "@/lib/keys";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export async function POST(req: NextRequest) {
  const { filename, contentType, size, userId = "demo-user" } = await req.json();

  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename and contentType required" }, { status: 400 });
  }
  if (!ALLOWED.has(contentType)) {
    return NextResponse.json({ error: `unsupported type: ${contentType}` }, { status: 415 });
  }
  if (typeof size === "number" && size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 10MB)" }, { status: 413 });
  }

  const uploadId = randomUUID();
  const key = resumeKey(userId, uploadId, filename);

  // The browser must send exactly this Content-Type or the signature fails.
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );

  // Saved as PENDING. It only becomes READY after the server checks storage.
  await putUpload({
    uploadId,
    userId,
    key,
    filename,
    contentType,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ uploadId, key, url, expiresIn: 300 });
}
