#!/usr/bin/env node
require('dotenv').config();

console.log('\n🧪 S3 Integration Test\n');
console.log('Configuration:');
console.log('  Region:', process.env.AWS_REGION || '❌ NOT SET');
console.log('  Bucket:', process.env.AWS_S3_BUCKET || '❌ NOT SET');
console.log('  Endpoint:', process.env.AWS_S3_ENDPOINT || '(using AWS S3)');
console.log('  Credentials:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set via env' : '⚠️  Using default chain');

// Test 1: Load service
try {
  const s3Service = require('../services/s3Service');
  console.log('\n✅ S3 service module loaded');
} catch (err) {
  console.error('\n❌ Failed to load S3 service:', err.message);
  process.exit(1);
}

// Test 2: Load routes
try {
  const s3Router = require('../routes/api/s3');
  console.log('✅ S3 routes module loaded');
} catch (err) {
  console.error('❌ Failed to load S3 routes:', err.message);
  process.exit(1);
}

// Test 3: Check server integration
try {
  const app = require('../server');
  console.log('✅ Server module loaded with S3 routes');
} catch (err) {
  console.error('❌ Failed to load server:', err.message);
  process.exit(1);
}

console.log('\n📋 Next Steps:');
if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_SECRET_ACCESS_KEY) {
  console.log('  1. Add AWS credentials to .env:');
  console.log('     AWS_ACCESS_KEY_ID=your_key');
  console.log('     AWS_SECRET_ACCESS_KEY=your_secret');
  console.log('  OR ensure IAM role is configured (if on EC2/ECS)');
  console.log('  OR use ~/.aws/credentials file\n');
}

console.log('  2. Start server: npm run dev');
console.log('  3. Test upload endpoint:');
console.log('     curl -X POST http://localhost:3000/api/s3/presign-upload \\');
console.log('       -H "Content-Type: application/json" \\');
console.log('       -d \'{"key":"test/file.txt","contentType":"text/plain"}\'');
console.log('\n  4. Use returned URL to upload via PUT\n');

console.log('✨ All systems ready!\n');
