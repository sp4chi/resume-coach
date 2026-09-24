// Ground truth: what is really in storage and Redis.
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import Redis from "ioredis";

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: process.env.S3_ENDPOINT ?? "http://localhost:4566",
  forcePathStyle: true,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const objs = await s3.send(new ListObjectsV2Command({ Bucket: process.env.STORAGE_BUCKET ?? "resume-coach-uploads" }));
console.log("STORAGE:");
for (const o of objs.Contents ?? []) console.log(`  ${o.Key}  (${o.Size} bytes)`);
if (!objs.Contents?.length) console.log("  (empty)");

console.log("\nREDIS:");
for (const k of await redis.keys("*")) {
  const type = await redis.type(k);
  const ttl = await redis.ttl(k);
  if (type === "string") {
    const v = await redis.get(k);
    const shown = k.startsWith("text:") ? `${v.length} chars of text` : v;
    console.log(`  ${k}  (ttl ${ttl}s)\n     ${shown}`);
  } else if (type === "list") {
    console.log(`  ${k}  (ttl ${ttl}s, ${await redis.llen(k)} turns)`);
  }
}
redis.disconnect();
