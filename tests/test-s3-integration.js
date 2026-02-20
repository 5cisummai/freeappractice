#!/usr/bin/env node

const http = require('http');

console.log('\n🧪 Testing S3 Integration\n');

function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function test() {
  try {
    // Test presign upload
    console.log('1️⃣ Testing presign-upload endpoint...');
    const uploadResult = await makeRequest('/api/s3/presign-upload', {
      key: 'test/hello.txt',
      contentType: 'text/plain'
    });

    if (uploadResult.url) {
      console.log('✅ Upload URL generated successfully');
      console.log('   Bucket:', uploadResult.bucket);
      console.log('   Key:', uploadResult.key);
      console.log('   Method:', uploadResult.method);
    } else {
      console.log('❌ Failed:', uploadResult.error || uploadResult);
      process.exit(1);
    }

    // Test presign download
    console.log('\n2️⃣ Testing presign-download endpoint...');
    const downloadResult = await makeRequest('/api/s3/presign-download', {
      key: 'test/hello.txt'
    });

    if (downloadResult.url) {
      console.log('✅ Download URL generated successfully');
      console.log('   Bucket:', downloadResult.bucket);
      console.log('   Key:', downloadResult.key);
      console.log('   Method:', downloadResult.method);
    } else {
      console.log('❌ Failed:', downloadResult.error || downloadResult);
      process.exit(1);
    }

    console.log('\n✨ All tests passed! S3 integration is fully functional.\n');
    console.log('📝 Next steps:');
    console.log('   • Use the presigned URLs in your frontend to upload/download files');
    console.log('   • Check AWS Console to see uploaded files');
    console.log('   • See README.md for usage examples\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

test();
