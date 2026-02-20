const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const DEFAULT_EXPIRES = 900; // 15 minutes

function createS3Client() {
  const region = process.env.AWS_REGION;
  const endpoint = process.env.AWS_S3_ENDPOINT; // optional (MinIO/R2)
  const forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE === 'true';

  const cfg = { region };
  if (endpoint) {
    cfg.endpoint = endpoint;
    cfg.forcePathStyle = forcePathStyle;
  }
  // Credentials are resolved via default provider chain (env/role/SharedIniFile)
  return new S3Client(cfg);
}

const s3 = createS3Client();
const defaultBucket = process.env.AWS_S3_BUCKET;

function resolveBucket(bucket) {
  return bucket || defaultBucket;
}

async function getPresignedUploadUrl({ key, bucket, contentType, expiresIn = DEFAULT_EXPIRES }) {
  const cmd = new PutObjectCommand({
    Bucket: resolveBucket(bucket),
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn });
  return { url, method: 'PUT', headers: contentType ? { 'Content-Type': contentType } : {} };
}

async function getPresignedDownloadUrl({ key, bucket, expiresIn = DEFAULT_EXPIRES }) {
  const cmd = new GetObjectCommand({
    Bucket: resolveBucket(bucket),
    Key: key,
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn });
  return { url, method: 'GET' };
}

async function putObject({ key, bucket, body, contentType }) {
  const cmd = new PutObjectCommand({
    Bucket: resolveBucket(bucket),
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  return s3.send(cmd);
}

async function getObjectStream({ key, bucket }) {
  const cmd = new GetObjectCommand({ Bucket: resolveBucket(bucket), Key: key });
  const resp = await s3.send(cmd);
  return resp.Body; // Node.js stream
}

async function listObjects({ prefix = '', bucket, maxKeys = 1000 }) {
  const cmd = new ListObjectsV2Command({
    Bucket: resolveBucket(bucket),
    Prefix: prefix,
    MaxKeys: maxKeys,
  });
  const resp = await s3.send(cmd);
  return resp.Contents || [];
}

module.exports = {
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  putObject,
  getObjectStream,
  listObjects,
};
