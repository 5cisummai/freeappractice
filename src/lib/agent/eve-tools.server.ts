import { z } from 'zod';
import type { RequestEvent } from '@sveltejs/kit';
import { authorizeFeatureRequest } from '#lib/agent/access.server.js';
import { inspectCoachImage } from '#lib/agent/attachments/images.server.js';
import { getConversationMessages } from '#lib/agent/conversations/store.server.js';
import {
	claimEveToolCall,
	getEveTurn,
	getEveToolRecord,
	isEveServiceRequest,
	recordEveSearch,
	setEveToolRecord
} from '#lib/agent/eve-turn.server.js';
import { coachQuestionText } from '#lib/agent/personalization/context.server.js';
import { createReadTools } from '#lib/agent/tools/read.server.js';
import { generateCoachSimulation, SIM_MODEL } from '#lib/agent/tools/simulation.server.js';
import { getPersonalizedUsage } from '#lib/agent/usage/controls.server.js';
import { usdFromLanguageModelUsage, WEB_SEARCH_SURCHARGE_MILLI } from '#lib/agent/usage/credits.js';
import { generativeCanvasToolInputSchema } from '#lib/canvas/schemas.js';
import { readJsonBody } from '#lib/server/request-body.server.js';
import { logger } from '#lib/server/logger.js';

/** Eve channel tokens are `channelName:uuid`; accept either form. */
const turnIdSchema = z
	.string()
	.min(1)
	.max(200)
	.transform((value, context) => {
		const local = value.includes(':') ? value.slice(value.indexOf(':') + 1) : value;
		const parsed = z.uuid().safeParse(local);
		if (!parsed.success) {
			context.addIssue({ code: 'custom', message: 'Invalid turn id' });
			return z.NEVER;
		}
		return parsed.data;
	});

const envelope = z.strictObject({
	turnId: turnIdSchema,
	callId: z.string().min(1).max(200),
	input: z.unknown().optional().default({})
});

export const eveToolNames = [
	'read_current_question',
	'read_course_catalog',
	'read_profile',
	'read_progress_summary',
	'read_activity_summary',
	'read_study_plan',
	'read_unit_detail',
	'read_frq_performance',
	'read_quiz_attempt',
	'open_physics_sim',
	'open_math_explorer',
	'inspect_coach_image',
	'resolve_chat_target',
	'authorize_search',
	'complete_search'
] as const;

const eveToolNameSchema = z.enum(eveToolNames);

export async function handleEveTool(event: RequestEvent): Promise<Response> {
	if (!isEveServiceRequest(event.request)) return new Response(null, { status: 401 });
	const name = eveToolNameSchema.safeParse(event.params.tool);
	if (!name.success) return new Response(null, { status: 404 });
	const request = envelope.safeParse(
		await readJsonBody(event.request, 24 * 1024).catch(() => null)
	);
	if (!request.success) return new Response(null, { status: 400 });

	try {
		const { turnId, callId, input } = request.data;
		const turn = await getEveTurn(turnId);
		if (!turn) return new Response(null, { status: 401 });
		if (!turn.scopes.includes(name.data)) return new Response(null, { status: 403 });
		const access = await authorizeFeatureRequest(event, turn.sub, 'coach');
		if (!access.allowed) return new Response(null, { status: access.status });

		switch (name.data) {
			case 'resolve_chat_target': {
				const target = z
					.strictObject({ messageId: z.string().min(1).max(200).optional() })
					.safeParse(input);
				if (!target.success) return new Response(null, { status: 400 });
				const messages = await getConversationMessages(turn.sub, turn.conversationId, 96);
				const row = messages.findLast(
					(message) =>
						message.role === 'user' &&
						message.status === 'complete' &&
						(!target.data.messageId ||
							target.data.messageId === (message.clientMessageId ?? message.id))
				);
				return Response.json({ targetId: row ? (row.clientMessageId ?? row.id) : null });
			}
			case 'inspect_coach_image': {
				const image = z.strictObject({ imageId: z.uuid() }).safeParse(input);
				if (!image.success) return new Response(null, { status: 400 });
				return Response.json(
					await inspectCoachImage(turn.sub, turn.conversationId, image.data.imageId)
				);
			}
			case 'authorize_search':
			case 'complete_search': {
				if (!z.strictObject({}).safeParse(input).success)
					return new Response(null, { status: 400 });
				if (name.data === 'complete_search') {
					return Response.json({ ok: await recordEveSearch(turnId, callId, 'complete') });
				}
				const usage = await getPersonalizedUsage(turn.sub, turn.accessReason);
				const maxSearches = Math.floor(usage.remaining / WEB_SEARCH_SURCHARGE_MILLI);
				const allowed = await recordEveSearch(turnId, callId, 'authorize', maxSearches);
				return Response.json({ allowed });
			}
		}

		if (name.data === 'open_physics_sim' || name.data === 'open_math_explorer') {
			const cached = await getEveToolRecord<{ title?: string; error?: string }>(
				turnId,
				`simulation:${callId}`
			);
			if (cached) return Response.json({ title: cached.title, error: cached.error });
			let simulationUsd = 0;
			const parsed = generativeCanvasToolInputSchema.safeParse(input);
			if (!parsed.success) return new Response(null, { status: 400 });
			if (!(await claimEveToolCall(turnId, `simulation-claim:${callId}`))) {
				return new Response(null, { status: 409 });
			}
			const result = await generateCoachSimulation(name.data, parsed.data, {
				abortSignal: event.request.signal,
				recordGenerationUsage: (usage) => {
					simulationUsd += usdFromLanguageModelUsage(usage, SIM_MODEL);
				}
			});
			await setEveToolRecord(turnId, `simulation-spend:${callId}`, simulationUsd);
			await setEveToolRecord(turnId, `simulation:${callId}`, result);
			return Response.json('error' in result ? result : { title: result.title });
		}

		if (!input || typeof input !== 'object' || 'userId' in input) {
			return new Response(null, { status: 400 });
		}
		const result = await createReadTools({
			locals: event.locals,
			userId: turn.sub,
			currentContext: turn.context
		})[name.data](input);
		if (!result.ok) return new Response(null, { status: 400 });
		const output = result.output;
		if (
			name.data === 'read_current_question' &&
			output &&
			typeof output === 'object' &&
			'kind' in output
		) {
			return Response.json({
				question: coachQuestionText(output as Parameters<typeof coachQuestionText>[0])
			});
		}
		const currentQuestionId = turn.context.questionId;
		if (currentQuestionId && output && typeof output === 'object') {
			if ('questions' in output && Array.isArray(output.questions)) {
				return Response.json({
					...output,
					questions: output.questions.filter((item) => item.questionId !== currentQuestionId)
				});
			}
			if ('recentMistakes' in output && Array.isArray(output.recentMistakes)) {
				return Response.json({
					...output,
					recentMistakes: output.recentMistakes.filter(
						(item) => item.questionId !== currentQuestionId
					)
				});
			}
		}
		return Response.json(output);
	} catch (error) {
		logger.warn('Eve Coach tool failed', {
			tool: name.data,
			errorType: error instanceof Error ? error.name : 'UnknownError'
		});
		return new Response(null, { status: 503 });
	}
}
