// @ts-check
// uploadS3File を本物の @aws-sdk/* のまま、ローカルの偽 S3 サーバーに対して実行する

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** @type {Map<string, Buffer>} */
const objects = new Map();
/** @type {Map<string, Map<number, Buffer>>} */
const multipartUploads = new Map();

const server = http.createServer((req, res) => {
  /** @type {Buffer[]} */
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, 'http://localhost');
    const key = decodeURIComponent(url.pathname);
    const query = url.searchParams;

    if (req.method === 'POST' && query.has('uploads')) {
      // CreateMultipartUpload
      const uploadId = `upload-${multipartUploads.size + 1}`;
      multipartUploads.set(uploadId, new Map());
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(
        `<?xml version="1.0" encoding="UTF-8"?><InitiateMultipartUploadResult><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`,
      );
      return;
    }
    if (req.method === 'PUT' && query.has('partNumber')) {
      // UploadPart
      const partNumber = Number(query.get('partNumber'));
      multipartUploads.get(query.get('uploadId')).set(partNumber, body);
      res.writeHead(200, { ETag: `"part-${partNumber}"` });
      res.end();
      return;
    }
    if (req.method === 'POST' && query.has('uploadId')) {
      // CompleteMultipartUpload
      const parts = multipartUploads.get(query.get('uploadId'));
      const sorted = [...parts.keys()].sort((a, b) => a - b).map((n) => parts.get(n));
      objects.set(key, Buffer.concat(sorted));
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(
        '<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUploadResult><ETag>"complete"</ETag></CompleteMultipartUploadResult>',
      );
      return;
    }
    if (req.method === 'PUT') {
      // PutObject
      objects.set(key, body);
      res.writeHead(200, { ETag: '"object"' });
      res.end();
      return;
    }
    res.writeHead(400);
    res.end();
  });
});

/** @type {string} */
let tmpDir;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(undefined)));
  const address = /** @type {import('node:net').AddressInfo} */ (server.address());
  process.env.AWS_ENDPOINT_URL_S3 = `http://127.0.0.1:${address.port}`;
  process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.AWS_REGION = 'ap-northeast-1';
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nair-s3-test-'));
});

after(() => {
  server.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('大きいファイルはマルチパートでアップロードされ、内容が一致する', async () => {
  const { uploadS3File } = require('../scripts/uploadArtifacts');
  // lib-storage の既定パートサイズ(5MiB)を超えるサイズ
  const content = Buffer.alloc(12 * 1024 * 1024);
  for (let i = 0; i < content.length; i += 4096) content[i] = i % 251;
  const filePath = path.join(tmpDir, 'n-air-setup.exe');
  fs.writeFileSync(filePath, content);

  await uploadS3File({
    name: 'n-air-setup.exe',
    bucketName: 'test-bucket',
    filePath,
    keyPrefix: 'download/windows',
  });

  const uploaded = objects.get('/test-bucket/download/windows/n-air-setup.exe');
  assert.ok(uploaded, 'object should be uploaded');
  assert.ok(uploaded.equals(content), 'uploaded content should match');
  assert.ok(
    [...multipartUploads.values()].some((parts) => parts.size > 1),
    'should be uploaded with multiple parts',
  );
});

test('小さいファイルは単一リクエストでアップロードされ、内容が一致する', async () => {
  const { uploadS3File } = require('../scripts/uploadArtifacts');
  const content = 'version: 1.0.20190826-1\npath: n-air-setup.exe\n';
  const filePath = path.join(tmpDir, 'latest.yml');
  fs.writeFileSync(filePath, content);

  await uploadS3File({
    name: 'latest.yml',
    bucketName: 'test-bucket',
    filePath,
    keyPrefix: 'download/windows-unstable',
  });

  const uploaded = objects.get('/test-bucket/download/windows-unstable/latest.yml');
  assert.equal(uploaded?.toString('utf-8'), content);
});
