import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { extractText, getDocumentProxy } from "unpdf";
import { s3, BUCKET } from "@/lib/storage";
import { getUpload, patchUpload, putResumeText } from "@/lib/store";

// Text is pulled out ONCE, here, right after upload.
// The chat route never opens the file again -- it reads the cached text.
// This replaces AWS Textract. unpdf runs inside our own process, so it is
// free and fast. Textract is only needed for scanned (image) resumes.
export async function POST(req: NextRequest) {
  const { uploadId, userId = "demo-user" } = await req.json();
  if (!uploadId) return NextResponse.json({ error: "uploadId required" }, { status: 400 });

  const rec = await getUpload(userId, uploadId);
  if (!rec) return NextResponse.json({ error: "unknown uploadId" }, { status: 404 });
  if (rec.status === "PENDING") {
    return NextResponse.json({ error: "upload not confirmed yet" }, { status: 409 });
  }

  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: rec.key }));
  const bytes = new Uint8Array(await obj.Body!.transformToByteArray());

  let text = "";
  try {
    if (rec.contentType === "application/pdf") {
      const pdf = await getDocumentProxy(bytes);
      const out = await extractText(pdf, { mergePages: true });
      text = Array.isArray(out.text) ? out.text.join("\n") : out.text;
    } else if (rec.contentType === "text/plain") {
      text = new TextDecoder().decode(bytes);
    } else {
      return NextResponse.json(
        { error: `no parser for ${rec.contentType} yet` },
        { status: 415 }
      );
    }
  } catch {
    return NextResponse.json({ error: "could not read the file" }, { status: 422 });
  }

  text = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  if (text.length < 50) {
    // Almost no text usually means a scanned image. That is the real case
    // where something like Textract or Document AI would be needed.
    return NextResponse.json(
      { error: "very little text found — is this a scanned image?", chars: text.length },
      { status: 422 }
    );
  }

  await putResumeText(userId, uploadId, text);
  await patchUpload(userId, uploadId, { status: "PARSED", textChars: text.length });

  return NextResponse.json({ parsed: true, chars: text.length, preview: text.slice(0, 200) });
}
