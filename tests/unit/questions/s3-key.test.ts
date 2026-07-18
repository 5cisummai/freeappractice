import { describe, expect, it } from 'vitest';
import { S3KeyValidationError, validateS3ObjectKey } from '$lib/questions/s3.server';

describe('validateS3ObjectKey', () => {
	it('accepts keys under the questions/ prefix', () => {
		expect(validateS3ObjectKey('questions/ap-biology/q1.json')).toBe(
			'questions/ap-biology/q1.json'
		);
		expect(validateS3ObjectKey('  questions/foo.json  ')).toBe('questions/foo.json');
	});

	it('accepts canonical FRQ keys under the frqs/ prefix', () => {
		expect(validateS3ObjectKey('frqs/3c0f9bb7-f208-4a1c-985f-bf312d0d4301.json')).toBe(
			'frqs/3c0f9bb7-f208-4a1c-985f-bf312d0d4301.json'
		);
	});

	it.each([
		['', 'key is required'],
		['   ', 'key is required'],
		['/questions/foo.json', 'key contains invalid path segments'],
		['questions/../secret.json', 'key contains invalid path segments'],
		['questions\\foo.json', 'key contains invalid path segments'],
		['other/foo.json', 'key must start with one of: questions/']
	])('rejects %j', (key, message) => {
		expect(() => validateS3ObjectKey(key)).toThrow(S3KeyValidationError);
		expect(() => validateS3ObjectKey(key)).toThrow(message);
	});
});
