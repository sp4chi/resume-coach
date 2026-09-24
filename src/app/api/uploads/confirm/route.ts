import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "@/lib/storage";
import { getUpload, patchUpload } from "@/lib/store";
import { requireUser } from "@/lib/user";

// The client saying "it worked" proves nothing. This asks storage directly.
export async function POST(req: NextRequest) {
  const { userId, denied } = await requireUser();
  if (denied) return denied;
  const { uploadId } = await req.json();
  if (!uploadId) return NextResponse.json({ error: "uploadId required" }, { status: 400 });

  const rec = await getUpload(userId, uploadId);
  if (!rec) return NextResponse.json({ error: "unknown uploadId" }, { status: 404 });

  // We check the key the SERVER saved, never a key sent by the client.
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: rec.key }));
    await patchUpload(userId, uploadId, {
      status: "READY",
      sizeBytes: head.ContentLength,
      confirmedAt: new Date().toISOString(),
    });
    return NextResponse.json({ confirmed: true, sizeBytes: head.ContentLength });
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : "Unknown";
    return NextResponse.json(
      { confirmed: false, reason: name, message: "File is not in storage." },
      { status: 422 }
    );
  }
}
