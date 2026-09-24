// Turn the bucket's PUT permission on or off, to test the failure path.
//   node scripts/toggle-cors.mjs break   -> uploads should fail loudly
//   node scripts/toggle-cors.mjs fix     -> uploads should work again
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const allowPut = process.argv[2] === "fix";
const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:4566",
  forcePathStyle: true,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

await s3.send(new PutBucketCorsCommand({
  Bucket: process.env.STORAGE_BUCKET ?? "resume-coach-uploads",
  CORSConfiguration: {
    CORSRules: [{
      AllowedOrigins: ["http://localhost:3000"],
      AllowedMethods: allowPut ? ["PUT", "GET"] : ["GET"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
    }],
  },
}));
console.log(allowPut ? "CORS: PUT allowed" : "CORS: PUT removed (broken on purpose)");
