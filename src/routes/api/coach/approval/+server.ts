import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Kept for compatibility with older route aliases. Current Coach approvals are
 * handled through AI SDK tool-approval-response parts in the chat stream.
 */
export const POST: RequestHandler = async () =>
	json({ error: 'Coach approvals are handled in the chat.' }, { status: 410 });
