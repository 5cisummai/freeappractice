import { randomUUID } from 'node:crypto';
import { and, eq, isNull, isNotNull, lte, or, count } from 'drizzle-orm';
import { tool } from 'ai';
import { z } from 'zod';
import { getNeonDatabase } from '$lib/server/neon/db';
import { coachImages } from '$lib/server/neon/schema';
import { isCoachImagesEnabled } from '$lib/flags';
import { coachImageId, coachImageUrl } from './coach-images';
import { CoachImageError, validateCoachImage } from './coach-image-validation.server';
import {
	coachImageStore,
	putCoachImage,
	readCoachImage,
	deleteCoachImage,
	type CoachImageStore
} from './coach-image-storage.server';
import type { SuperAgentUIMessage } from './agent.server';

export async function getOwnedCoachImage(userId: string, id: string, conversationId?: string) {
	const [row] = await getNeonDatabase()
		.select()
		.from(coachImages)
		.where(
			and(
				eq(coachImages.id, id),
				eq(coachImages.userId, userId),
				conversationId ? eq(coachImages.conversationId, conversationId) : undefined
			)
		)
		.limit(1);
	return row?.conversationId && row.messageId ? row : null;
}

export async function coachImageManifest(userId: string, conversationId: string): Promise<string> {
	if (!(await isCoachImagesEnabled())) return '';
	const rows = await getNeonDatabase()
		.select({ id: coachImages.id, createdAt: coachImages.createdAt })
		.from(coachImages)
		.where(
			and(
				eq(coachImages.userId, userId),
				eq(coachImages.conversationId, conversationId),
				isNotNull(coachImages.messageId)
			)
		)
		.limit(50);
	return rows.length
		? `Saved images available in this chat (ID, upload time):\n${rows.map((row) => `${row.id}, ${row.createdAt.toISOString()}`).join('\n')}`
		: '';
}

export async function prepareCoachImageParts(
	userId: string,
	conversationId: string,
	parts: Record<string, unknown>[]
) {
	const files = parts.filter((part) => part.type === 'file');
	if (files.length > 1) throw new CoachImageError('Attach one image per message.');
	const savedParts: SuperAgentUIMessage['parts'] = parts
		.filter((part) => part.type === 'text' && typeof part.text === 'string')
		.map((part) => ({ type: 'text', text: part.text as string }));
	let upload: { id: string; bytes: Buffer } | undefined;
	if (files.length) {
		if (!(await isCoachImagesEnabled()))
			throw new CoachImageError('Coach image input is currently unavailable.');
		const existingId = coachImageId(files[0].url);
		if (existingId) {
			if (!(await getOwnedCoachImage(userId, existingId, conversationId)))
				throw new CoachImageError('Image unavailable in this chat.');
			savedParts.push({ type: 'file', mediaType: 'image/webp', url: coachImageUrl(existingId) });
		} else {
			const [total] = await getNeonDatabase()
				.select({ count: count() })
				.from(coachImages)
				.where(eq(coachImages.userId, userId));
			if (total.count >= 500)
				throw new CoachImageError('Delete older chats before uploading more images.');
			const [chatTotal] = await getNeonDatabase()
				.select({ count: count() })
				.from(coachImages)
				.where(and(eq(coachImages.userId, userId), eq(coachImages.conversationId, conversationId)));
			if (chatTotal.count >= 50)
				throw new CoachImageError('Start a new chat to upload more images.');
			const bytes = await validateCoachImage(files[0]);
			const id = randomUUID();
			const store = coachImageStore();
			const pathname = `coach-images/${id}.webp`;
			// Record the path before uploading so interrupted uploads can be cleaned up.
			await getNeonDatabase()
				.insert(coachImages)
				.values({
					id,
					userId,
					conversationId,
					store,
					pathname,
					nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000)
				});
			await putCoachImage(store, pathname, bytes);
			await getNeonDatabase()
				.update(coachImages)
				.set({ nextAttemptAt: new Date() })
				.where(eq(coachImages.id, id));
			upload = { id, bytes };
			savedParts.push({ type: 'file', mediaType: 'image/webp', url: coachImageUrl(id) });
		}
	}
	return { savedParts, upload };
}

export async function linkCoachImage(
	id: string,
	userId: string,
	conversationId: string,
	messageId: string
) {
	await getNeonDatabase()
		.update(coachImages)
		.set({ messageId })
		.where(
			and(
				eq(coachImages.id, id),
				eq(coachImages.userId, userId),
				eq(coachImages.conversationId, conversationId)
			)
		);
}

/** Only a newly uploaded image is hydrated; older images become inspectable references. */
export function coachImageModelMessages(
	messages: SuperAgentUIMessage[],
	upload?: { id: string; bytes: Buffer }
): SuperAgentUIMessage[] {
	return messages.map((message) => ({
		...message,
		parts: message.parts.map((part) => {
			if (part.type !== 'file') return part;
			const id = coachImageId(part.url);
			if (!id) return { type: 'text', text: '[Image unavailable]' };
			if (upload?.id === id)
				return {
					type: 'file',
					mediaType: 'image/webp',
					url: `data:image/webp;base64,${upload.bytes.toString('base64')}`
				};
			return {
				type: 'text',
				text: `[Saved Coach image: ${id}. Use inspect_coach_image to view it.]`
			};
		})
	}));
}

export function inspectCoachImageTool(userId: string, conversationId?: string) {
	const freshCalls = new Set<string>();
	return tool({
		description:
			'Inspect an image saved in this chat. Use the image ID from a previous message when its visual details are needed for a follow-up.',
		inputSchema: z.object({ imageId: z.uuid() }),
		execute: async ({ imageId }, { toolCallId }) => {
			if (
				!conversationId ||
				!(await isCoachImagesEnabled()) ||
				!(await getOwnedCoachImage(userId, imageId, conversationId))
			)
				return { imageId, available: false };
			freshCalls.add(toolCallId);
			return { imageId, available: true };
		},
		toModelOutput: async ({ toolCallId, output }) => {
			// History conversion must never re-fetch every previously inspected image.
			if (!output.available || !freshCalls.has(toolCallId) || !conversationId)
				return {
					type: 'text',
					value: `Saved image ${output.imageId}; ${output.available ? 'inspect again if needed' : 'unavailable'}.`
				};
			const row = await getOwnedCoachImage(userId, output.imageId, conversationId);
			if (!row) return { type: 'text', value: 'Image unavailable.' };
			const bytes = await readCoachImage(row.store as CoachImageStore, row.pathname);
			return {
				type: 'content',
				value: [{ type: 'image-data', data: bytes.toString('base64'), mediaType: 'image/webp' }]
			};
		}
	});
}

export async function cleanupCoachImages(now = new Date(), userId?: string) {
	const db = getNeonDatabase();
	const rows = await db
		.select()
		.from(coachImages)
		.where(
			and(
				userId ? eq(coachImages.userId, userId) : undefined,
				lte(coachImages.nextAttemptAt, now),
				or(
					isNull(coachImages.conversationId),
					and(
						isNull(coachImages.messageId),
						lte(coachImages.createdAt, new Date(now.getTime() - 60 * 60 * 1000))
					)
				)
			)
		)
		.limit(100);
	for (const row of rows) {
		try {
			await deleteCoachImage(row.store as CoachImageStore, row.pathname);
			await db.delete(coachImages).where(eq(coachImages.id, row.id));
		} catch {
			await db
				.update(coachImages)
				.set({
					attempts: row.attempts + 1,
					nextAttemptAt: new Date(now.getTime() + 60 * 60 * 1000)
				})
				.where(eq(coachImages.id, row.id));
		}
	}
}
