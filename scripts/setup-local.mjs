// Creates the local bucket and its CORS rules. Safe to re-run.
import { S3Client, CreateBucketCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.STORAGE_BUCKET ?? "resume-coach-uploads";
const ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:4566";

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

try {
  await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  console.log(`bucket ${BUCKET} created`);
} catch (e) {
  console.log(`bucket ${BUCKET}: ${e.name} (fine if it already exists)`);
}

// PUT must be allowed. If it is missing, the browser blocks the upload before
// it is sent, and that failure has no HTTP status code at all.
await s3.send(new PutBucketCorsCommand({
  Bucket: BUCKET,
  CORSConfiguration: {
    CORSRules: [{
      AllowedOrigins: ["http://localhost:3000"],
      AllowedMethods: ["PUT", "GET"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3000,
    }],
  },
}));
console.log("CORS allows PUT from http://localhost:3000");
