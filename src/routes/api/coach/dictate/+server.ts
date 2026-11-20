import { transcribe } from 'ai';
import { z } from 'zod';
import { readJsonBody } from '#lib/server/request-body.server.js';
import { authorizeFeatureRequest } from '#lib/agent/access.server.js';
import { RedisRequiredError } from '#lib/agent/usage/controls.server.js';
import { startAgentTurn } from '#lib/agent/usage/turn.server.js';
import {
	createEmptyLanguageModelUsage,
	DICTATION_CREDITS_MILLI,
	CREDITS_PER_USD,
	MILLICREDITS_PER_CREDIT
} from '#lib/agent/usage/credits.js';
import { withAuthedHandler } from '#lib/auth/route-helpers.server.js';
import { logger } from '#lib/server/logger.js';

const DICTATION_MODEL = 'spacexai/grok-stt';

const inputSchema = z.object({
	audio: z
		.string()
		.min(1)
		.max(3_000_000)
		.regex(/^[A-Za-z0-9+/]+={0,2}$/)
});

export const POST = withAuthedHandler(
	async (event, userId) => {
		if (event.request.headers.get('origin') !== event.url.origin)
			return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
		const access = await authorizeFeatureRequest(event, userId, 'coach');
		if (!access.allowed) return Response.json({ error: access.message }, { status: access.status });
		const input = inputSchema.safeParse(
			await readJsonBody(event.request, 3_100_000).catch(() => null)
		);
		if (!input.success)
			return Response.json({ error: 'Invalid dictation audio.' }, { status: 400 });
		const startedAt = Date.now();
		try {
			const turn = await startAgentTurn(userId, access.planAccess.accessReason ?? 'subscription');
			if (turn.kind === 'rate-limited') {
				return Response.json({ error: 'Too many dictation requests.' }, { status: 429 });
			}
			if (turn.kind === 'exhausted' || turn.usage.remaining < DICTATION_CREDITS_MILLI) {
				return Response.json(
					{ error: 'Dictation requires 0.1 Coach credits. Your remaining balance is too low.' },
					{ status: 429 }
				);
			}
			const result = await transcribe({
				model: DICTATION_MODEL,
				audio: input.data.audio,
				abortSignal: AbortSignal.any([event.request.signal, AbortSignal.timeout(45_000)])
			});
			await turn.chargeUsage(
				createEmptyLanguageModelUsage(),
				DICTATION_CREDITS_MILLI / (CREDITS_PER_USD * MILLICREDITS_PER_CREDIT)
			);
			return Response.json({ text: result.text }, { headers: { 'Cache-Control': 'no-store' } });
		} catch (error) {
			if (error instanceof RedisRequiredError) {
				return Response.json(
					{ error: 'Dictation usage tracking is temporarily unavailable.' },
					{ status: 503 }
				);
			}
			logger.error('Pip dictation failed', {
				elapsedMs: Date.now() - startedAt,
				name: error instanceof Error ? error.name : 'Unknown'
			});
			return Response.json(
				{ error: 'Audio processing failed. Please try again.' },
				{ status: 502 }
			);
		}
	},
	{ logLabel: 'Pip dictation', errorMessage: 'Dictation is unavailable.' }
);
