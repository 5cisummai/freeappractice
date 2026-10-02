import { spawnSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const started = spawnSync('docker', ['compose', 'up', '-d', 'rustfs'], { stdio: 'inherit' });
if (started.status !== 0) throw new Error('Could not start local object storage');
const client = new S3Client({
	endpoint: 'http://127.0.0.1:9000',
	region: 'us-east-1',
	forcePathStyle: true,
	credentials: { accessKeyId: 'local-coach', secretAccessKey: 'local-coach-storage-password' }
});
for (let attempt = 0; attempt < 20; attempt++) {
	try {
		try {
			await client.send(new HeadBucketCommand({ Bucket: 'coach-images' }));
		} catch {
			await client.send(new CreateBucketCommand({ Bucket: 'coach-images' }));
		}
		console.log('Private Coach image bucket ready. Console: http://127.0.0.1:9001');
		break;
	} catch (error) {
		if (attempt === 19) throw error;
		await setTimeout(1000);
	}
}
