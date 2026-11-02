import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
	rows: [] as unknown[],
	deleted: vi.fn(),
	updated: vi.fn(),
	read: vi.fn(),
	remove: vi.fn(),
	enabled: true,
	query: null as unknown
}));
vi.mock('#lib/flags.js', () => ({ isCoachImagesEnabled: async () => mocks.enabled }));
vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({
		select: () => ({
			from: () => ({
				where: (query: unknown) => {
					mocks.query = query;
					return { limit: async () => mocks.rows };
				}
			})
		}),
		delete: () => ({ where: mocks.deleted }),
		update: () => ({
			set: (values: unknown) => {
				mocks.updated(values);
				return { where: async () => {} };
			}
		})
	})
}));
vi.mock('#lib/agent/attachments/storage.server.js', () => ({
	readCoachImage: mocks.read,
	deleteCoachImage: mocks.remove
}));

import {
	validateCoachImage,
	validateCoachTextFile
} from '#lib/agent/attachments/validation.server.js';
import { coachImageUrl, COACH_IMAGE_MAX_BYTES } from '#lib/agent/attachments/images.js';
import { COACH_TEXT_MAX_BYTES, COACH_TEXT_MAX_CHARS } from '#lib/agent/attachments/text.js';
import {
	coachImageModelMessages,
	getOwnedCoachImage,
	inspectCoachImageTool,
	cleanupCoachImages,
	prepareCoachImageParts
} from '#lib/agent/attachments/images.server.js';

const id = 'ea2d389c-df43-4e24-b1d9-b8557fdbec25';
function file(bytes: Buffer, mediaType = 'image/png', filename?: string) {
	return {
		type: 'file',
		mediaType,
		url: `data:${mediaType};base64,${bytes.toString('base64')}`,
		...(filename ? { filename } : {})
	};
}
function textFile(text: string, mediaType = 'text/plain', filename = 'note.txt') {
	return file(Buffer.from(text, 'utf8'), mediaType, filename);
}
beforeEach(() => {
	vi.clearAllMocks();
	mocks.rows = [];
	mocks.enabled = true;
});

describe('Coach image validation', () => {
	it('decodes and normalizes a real image while stripping metadata', async () => {
		const png = await sharp({
			create: { width: 32, height: 32, channels: 3, background: '#ff0000' }
		})
			.withMetadata()
			.png()
			.toBuffer();
		const normalized = await validateCoachImage(file(png));
		const metadata = await sharp(normalized).metadata();
		expect(metadata.format).toBe('webp');
		expect(metadata.exif).toBeUndefined();
		expect(metadata.icc).toBeUndefined();
	});
	it.each([
		'https://example.com/private.png',
		'data:image/svg+xml;base64,PHN2Zz4=',
		'data:image/png;base64,YmFk',
		'data:image/png;base64,AAAA==='
	])('rejects unsafe or malformed input %s', async (url) => {
		await expect(
			validateCoachImage({ type: 'file', mediaType: 'image/png', url })
		).rejects.toThrow();
	});
	it('rejects bytes beyond the limit and dimensions beyond the limit', async () => {
		await expect(
			validateCoachImage(file(Buffer.alloc(COACH_IMAGE_MAX_BYTES + 1)))
		).rejects.toThrow();
		const wide = await sharp({
			create: { width: 8193, height: 1, channels: 3, background: '#ffffff' }
		})
			.png()
			.toBuffer();
		await expect(validateCoachImage(file(wide))).rejects.toThrow();
	});
	it('rejects MIME spoofing and multiple attachments', async () => {
		const jpeg = await sharp({
			create: { width: 2, height: 2, channels: 3, background: '#ffffff' }
		})
			.jpeg()
			.toBuffer();
		await expect(validateCoachImage(file(jpeg))).rejects.toThrow();
		await expect(prepareCoachImageParts('user', 'chat', [file(jpeg), file(jpeg)])).rejects.toThrow(
			'one file'
		);
	});
});

describe('Coach text file validation', () => {
	it('accepts utf-8 text adjacent files and normalizes the data URL', () => {
		const csv = validateCoachTextFile(textFile('a,b\n1,2\n', 'text/csv', 'scores.csv'));
		expect(csv).toMatchObject({
			mediaType: 'text/csv',
			filename: 'scores.csv',
			text: 'a,b\n1,2\n'
		});
		expect(csv.url).toBe(
			`data:text/csv;base64,${Buffer.from('a,b\n1,2\n', 'utf8').toString('base64')}`
		);
	});
	it('resolves type from filename when the data URL is octet-stream', () => {
		const bytes = Buffer.from('# hello', 'utf8');
		const part = {
			type: 'file',
			mediaType: 'text/markdown',
			filename: 'notes.md',
			url: `data:application/octet-stream;base64,${bytes.toString('base64')}`
		};
		expect(validateCoachTextFile(part).mediaType).toBe('text/markdown');
	});
	it('rejects binary, oversized, and unsupported text uploads', () => {
		expect(() => validateCoachTextFile(textFile('ok', 'text/html', 'x.html'))).toThrow(/TXT/);
		expect(() =>
			validateCoachTextFile(file(Buffer.from([0, 1, 2]), 'text/plain', 'note.txt'))
		).toThrow(/UTF-8/);
		expect(() =>
			validateCoachTextFile(
				file(Buffer.alloc(COACH_TEXT_MAX_BYTES + 1, 97), 'text/plain', 'note.txt')
			)
		).toThrow(/100 KB/);
		expect(() =>
			validateCoachTextFile(
				textFile('x'.repeat(COACH_TEXT_MAX_CHARS + 1), 'text/plain', 'note.txt')
			)
		).toThrow(/characters/);
	});
	it('stores text attachments inline and expands them for the model', async () => {
		const prepared = await prepareCoachImageParts('user', 'chat', [
			textFile('unit 3 review', 'text/plain', 'review.txt')
		]);
		expect(prepared.upload).toBeUndefined();
		expect(prepared.savedParts).toEqual([
			{
				type: 'file',
				mediaType: 'text/plain',
				filename: 'review.txt',
				url: `data:text/plain;base64,${Buffer.from('unit 3 review', 'utf8').toString('base64')}`
			}
		]);
		const model = coachImageModelMessages([
			{ id: 'msg', role: 'user', parts: prepared.savedParts }
		]);
		expect(model[0].parts[0]).toEqual({
			type: 'text',
			text: 'Attached file "review.txt" (text/plain):\n\nunit 3 review'
		});
	});
});

describe('Coach image history and access', () => {
	it('hydrates only the uploaded image, replacing older files with references', () => {
		const olderId = '1a2d389c-df43-4e24-b1d9-b8557fdbec25';
		const messages = [
			{
				id: 'msg',
				role: 'user' as const,
				parts: [
					{ type: 'file' as const, mediaType: 'image/webp', url: coachImageUrl(id) },
					{ type: 'file' as const, mediaType: 'image/webp', url: coachImageUrl(olderId) }
				]
			}
		];
		const result = coachImageModelMessages(messages, { id, bytes: Buffer.from('new-image') });
		expect(result[0].parts[0]).toMatchObject({
			type: 'file',
			url: 'data:image/webp;base64,bmV3LWltYWdl'
		});
		expect(result[0].parts[1]).toMatchObject({ type: 'text' });
		expect(JSON.stringify(messages)).not.toContain('base64');
	});
	it('constrains ownership lookup to user and conversation', async () => {
		expect(await getOwnedCoachImage('other-user', id, 'other-chat')).toBeNull();
		const query = new PgDialect().sqlToQuery(mocks.query as Parameters<PgDialect['sqlToQuery']>[0]);
		expect(query.params).toEqual([id, 'other-user', 'other-chat']);
	});
	it('keeps tool outputs small, hydrates fresh calls, and never hydrates replayed calls', async () => {
		mocks.rows = [{ id, conversationId: 'chat', messageId: 'msg', store: 's3', pathname: 'path' }];
		mocks.read.mockResolvedValue(Buffer.from('pixels'));
		const imageTool = inspectCoachImageTool('user', 'chat');
		const options = { toolCallId: 'fresh', messages: [], context: {} };
		const output = (await imageTool.execute!({ imageId: id }, options)) as {
			imageId: string;
			available: boolean;
		};
		expect(output).toEqual({ imageId: id, available: true });
		await imageTool.toModelOutput!({ toolCallId: 'old', input: { imageId: id }, output });
		expect(mocks.read).not.toHaveBeenCalled();
		const modelOutput = await imageTool.toModelOutput!({
			toolCallId: 'fresh',
			input: { imageId: id },
			output
		});
		expect(modelOutput).toMatchObject({
			type: 'content',
			value: [{ type: 'image-data', data: 'cGl4ZWxz' }]
		});
	});
	it('denies inspection when missing or disabled', async () => {
		const imageTool = inspectCoachImageTool('user', 'chat');
		expect(
			await imageTool.execute!({ imageId: id }, { toolCallId: 'call', messages: [], context: {} })
		).toEqual({ imageId: id, available: false });
		mocks.enabled = false;
		expect(
			await imageTool.execute!({ imageId: id }, { toolCallId: 'call', messages: [], context: {} })
		).toEqual({ imageId: id, available: false });
		expect(mocks.read).not.toHaveBeenCalled();
	});
	it('retains deletion records on failure and removes them after a successful retry', async () => {
		mocks.rows = [{ id, store: 's3', pathname: 'path', attempts: 0 }];
		mocks.remove.mockRejectedValueOnce(new Error('storage offline'));
		await cleanupCoachImages(new Date('2026-09-30T00:00:00Z'));
		expect(mocks.deleted).not.toHaveBeenCalled();
		expect(mocks.updated).toHaveBeenCalledWith({
			attempts: 1,
			nextAttemptAt: new Date('2026-09-30T01:00:00Z')
		});
		mocks.remove.mockResolvedValue(undefined);
		await cleanupCoachImages(new Date('2026-09-30T01:00:00Z'));
		expect(mocks.deleted).toHaveBeenCalled();
	});
});
