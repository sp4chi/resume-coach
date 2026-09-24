import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 speaks the S3 API, so the same client works for:
//   - LocalStack / MinIO  (local development, no account needed)
//   - Cloudflare R2       (production, 10GB free, no download charges)
//   - real AWS S3         (if you ever want it)
// Only the endpoint and credentials change.

type Mode = "local" | "r2" | "s3";

const mode: Mode =
  process.env.STORAGE_MODE === "r2" ? "r2"
  : process.env.STORAGE_MODE === "s3" ? "s3"
  : "local";

function clientConfig() {
  if (mode === "local") {
    return {
      region: "us-east-1",
      endpoint: process.env.S3_ENDPOINT ?? "http://localhost:4566",
      forcePathStyle: true,
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
    };
  }
  if (mode === "r2") {
    return {
      // R2 ignores the region, but the SDK requires one.
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    };
  }
  return { region: process.env.AWS_REGION ?? "us-east-1" };
}

export const s3 = new S3Client({
  ...clientConfig(),
  // The SDK signs an x-amz-checksum-crc32 header by default. A browser never
  // sends it, so every presigned PUT fails with HTTP 400. Required here.
  requestChecksumCalculation: "WHEN_REQUIRED",
});

export const BUCKET = process.env.STORAGE_BUCKET ?? "resume-coach-uploads";
export const STORAGE_MODE = mode;
