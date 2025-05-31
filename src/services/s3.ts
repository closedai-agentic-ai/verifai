import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

export async function uploadScreenshotToS3(params: {
  buffer: Buffer;
  extension: string;
  prefix: string;
}) {
  try {
    const REGION = process.env.AWS_REGION || "ap-south-1";
    const BUCKET = process.env.S3_BUCKET_NAME!;
    const s3 = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    });

    const { buffer, extension, prefix } = params;
    const key = `poc/${prefix}/${Date.now()}.${extension}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: `image/${extension}`,
    });
    await s3.send(command);
    console.log("Uploading screenshot to S3", key);
    return [`s3://${BUCKET}/${key}`];
  } catch (error) {
    console.error(error);
    return [null];
  }
}
