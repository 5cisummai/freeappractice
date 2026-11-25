import { randomUUID } from 'node:crypto';
import type { LanguageModelUsage, UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { AgentUIMessage } from '#lib/agent/message.js';
import type { CoachInlineTool } from '#lib/agent/eve-continuation.server.js';
import { eveServiceSecret, getEveToolRecord } from '#lib/agent/eve-turn.server.js';
import type { CoachThinkingMode } from '#lib/agent/request.js';
import { getCoachPracticeQuestionToolOutput } from '#lib/agent/tools/practice.js';
import {
	getCoachQuestionToolInput,
	getCoachQuestionToolOutput
} from '#lib/agent/tools/question.js';

type Part = AgentUIMessage['parts'][number];
const interactiveTools = new Set(['ask_student', 'give_practice_question']);
const writeTools = new Set(['update_goals', 'update_study_plan']);
const messageTools = new Set(['report_progress', 'send_message']);
const actions = new Set(['reply_to_message', 'react_to_message', ...messageTools]);

const id = z.string().min(1).max(200);
const tokenCount = z.number().int().nonnegative();
const usageSchema = z.object({
	inputTokens: tokenCount,
	outputTokens: tokenCount,
	cacheReadTokens: tokenCount,
	cacheWriteTokens: tokenCount
});
const eventSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('content.delta'),
		data: z.object({
			kind: z.string().optional(),
			partId: id,
			delta: z.string()
		})
	}),
	z.object({
		type: z.literal('content.completed'),
		data: z.object({
			kind: z.string(),
			partId: id,
			value: z.unknown().optional()
		})
	}),
	z.object({
		type: z.literal('call.requested'),
		data: z.object({
			callId: id,
			capability: z.object({ kind: z.string(), name: id }),
			input: z.unknown().optional(),
			inputError: z.unknown().optional()
		})
	}),
	z.object({
		type: z.literal('call.settled'),
		data: z.object({
			callId: id,
			outcome: z.string(),
			output: z.unknown().optional()
		})
	}),
	z.object({
		type: z.literal('usage.recorded'),
		data: z.object({ usage: usageSchema, owner: z.object({ runId: id.optional() }).optional() })
	}),
	z.object({ type: z.literal('delivery.settled'), data: z.object({ outcome: z.string() }) })
]);

type EveEvent = z.infer<typeof eventSchema>;

async function* eveEvents(response: Response): AsyncGenerator<EveEvent> {
	if (
		!response.ok ||
		!response.body ||
		!response.headers.get('content-type')?.startsWith('application/x-ndjson')
	) {
		throw new Error('Eve returned an invalid stream');
	}
	const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
	let pending = '';
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			pending += value;
			const lines = pending.split('\n');
			pending = lines.pop() ?? '';
			for (const line of lines) {
				if (line.length > 256_000) throw new Error('Eve event too large');
				if (line) yield eventSchema.parse(JSON.parse(line));
			}
			if (pending.length > 256_000) throw new Error('Eve event too large');
		}
		if (pending.trim()) throw new Error('Eve stream ended mid-event');
	} finally {
		await reader.cancel().catch(() => undefined);
		reader.releaseLock();
	}
}

function messageText(parts: Part[]) {
	return parts
		.flatMap((part) => {
			if (part.type === 'text') return [part.text];
			if (part.type === 'tool-ask_student') {
				const question = getCoachQuestionToolInput(part.input);
				const answer = 'output' in part ? getCoachQuestionToolOutput(part.output) : null;
				if (!question) return [];
				return [
					`Coach asked: ${question.question}`,
					...(answer?.status === 'answered'
						? [`Student answered: ${answer.response}`]
						: answer?.status === 'skipped'
							? ['Student skipped this question.']
							: [])
				];
			}
			if (part.type === 'tool-give_practice_question' && 'output' in part) {
				const outcome = getCoachPracticeQuestionToolOutput(part.output);
				if (!outcome) return [];
				return [
					`Practice result: ${outcome.status}, ${outcome.mode}, ${outcome.course}, ${outcome.unit}`,
					...(outcome.status === 'answered' &&
					outcome.mode === 'mcq' &&
					typeof outcome.isCorrect === 'boolean'
						? [`The student's selection was ${outcome.isCorrect ? 'correct' : 'incorrect'}.`]
						: [])
				];
			}
			if (part.type === 'tool-update_goals' || part.type === 'tool-update_study_plan') {
				if (part.state === 'output-denied')
					return [
						`Student declined ${part.type === 'tool-update_goals' ? 'the goals update' : 'the study plan update'}.`
					];
				if (
					part.state === 'output-available' &&
					part.output &&
					typeof part.output === 'object' &&
					'updated' in part.output &&
					part.output.updated
				) {
					return [
						`Student approved and Coach applied ${part.type === 'tool-update_goals' ? 'the goals update' : 'the study plan update'}.`
					];
				}
			}
			return [];
		})
		.join('\n');
}

export function buildEveInput(messages: AgentUIMessage[], continuing: boolean) {
	const active = messages.at(-1);
	let remainingHistoryChars = 128_000;
	const history = messages
		.slice(0, -1)
		.reverse()
		.flatMap((message) => {
			const text = messageText(message.parts).slice(0, Math.min(remainingHistoryChars, 23_700));
			remainingHistoryChars -= text.length;
			return text && (message.role === 'user' || message.role === 'assistant')
				? [
						{
							role: message.role,
							id: message.id,
							text:
								message.role === 'user'
									? `[Message ID: ${message.id}]\n${text}`.slice(0, 24_000)
									: text
						}
					]
				: [];
		})
		.reverse();
	if (continuing) {
		return {
			history,
			text: 'The pending card above now has a response in the turn context. Apply it and continue the original request. Do not repeat the card that just completed.'
		};
	}
	const image = active?.parts.find(
		(part) => part.type === 'file' && part.url.startsWith('data:image/')
	);
	return {
		history,
		text: active ? messageText(active.parts).slice(0, 120_000) : '',
		...(image?.type === 'file' ? { image: { mediaType: image.mediaType, data: image.url } } : {})
	};
}

export async function streamEveTurn(input: {
	turnId: string;
	deadline: number;
	context: string;
	mode: CoachThinkingMode;
	messages: AgentUIMessage[];
	continuing: boolean;
	completedTool?: CoachInlineTool;
	signal: AbortSignal;
	writer: UIMessageStreamWriter<AgentUIMessage>;
	onUsage: (usage: LanguageModelUsage) => void;
	onSimulationUsage: (usd: number) => void;
}) {
	const serviceUrl = process.env.COACH_EVE_URL;
	if (!serviceUrl) throw new Error('Eve Coach service URL is missing');
	const response = await fetch(new URL('/coach/v1/turn', serviceUrl), {
		method: 'POST',
		redirect: 'error',
		headers: {
			authorization: `Bearer ${eveServiceSecret()}`,
			'content-type': 'application/json',
			...(process.env.COACH_EVE_VERCEL_BYPASS
				? { 'x-vercel-protection-bypass': process.env.COACH_EVE_VERCEL_BYPASS }
				: {})
		},
		body: JSON.stringify({
			turnId: input.turnId,
			deadline: input.deadline,
			context: input.context.slice(0, 24_000),
			mode: input.mode,
			completedTool: input.completedTool,
			...buildEveInput(input.messages, input.continuing)
		}),
		signal: input.signal
	});

	const { writer, turnId } = input;
	const textParts = new Map<string, string>();
	const reasoningParts = new Set<string>();
	const calls = new Map<string, { name: string; id: string; input: unknown }>();
	const settled = new Set<string>();
	const meteredRuns = new Set<string>();
	let handled = false;
	let pendingCard = false;
	for await (const event of eveEvents(response)) {
		switch (event.type) {
			case 'content.delta': {
				const { partId, kind, delta } = event.data;
				if (kind === 'text' || textParts.has(partId)) {
					textParts.set(partId, (textParts.get(partId) ?? '') + delta);
				} else {
					if (kind === 'reasoning' && !reasoningParts.has(partId)) {
						reasoningParts.add(partId);
						writer.write({ type: 'reasoning-start', id: `${turnId}:${partId}` });
					}
					if (reasoningParts.has(partId)) {
						writer.write({ type: 'reasoning-delta', id: `${turnId}:${partId}`, delta });
					}
				}
				break;
			}
			case 'content.completed': {
				const { partId, kind, value } = event.data;
				const partKey = `${turnId}:${partId}`;
				const completedText = typeof value === 'string' ? value : textParts.get(partId);
				textParts.delete(partId);
				if (reasoningParts.delete(partId)) {
					writer.write({ type: 'reasoning-end', id: partKey });
				} else if (completedText && (kind === 'text' || kind === 'reasoning')) {
					writer.write({ type: `${kind}-start`, id: partKey });
					writer.write({ type: `${kind}-delta`, id: partKey, delta: completedText });
					writer.write({ type: `${kind}-end`, id: partKey });
				}
				break;
			}
			case 'call.requested': {
				const { callId, capability, input: toolInput, inputError } = event.data;
				if (inputError || capability.kind !== 'tool' || calls.has(callId)) break;
				const call = { name: capability.name, id: callId, input: toolInput };
				calls.set(callId, call);
				if (
					!actions.has(call.name) &&
					!interactiveTools.has(call.name) &&
					!writeTools.has(call.name)
				) {
					writer.write({
						type: 'tool-input-available',
						toolName: call.name,
						toolCallId: call.id,
						input: call.input,
						providerExecuted: true
					});
				}
				break;
			}
			case 'call.settled': {
				const { callId, outcome, output } = event.data;
				const call = calls.get(callId);
				if (!call || settled.has(callId)) break;
				settled.add(callId);
				if (actions.has(call.name)) {
					if (outcome !== 'completed') break;
					if (messageTools.has(call.name)) {
						const bubble = z
							.object({
								message: z
									.string()
									.trim()
									.min(1)
									.max(call.name === 'report_progress' ? 240 : 1800)
							})
							.safeParse(output);
						if (bubble.success) {
							const textId = `${turnId}:message:${callId}`;
							writer.write({ type: 'text-start', id: textId });
							writer.write({ type: 'text-delta', id: textId, delta: bubble.data.message });
							writer.write({ type: 'text-end', id: textId });
						}
						break;
					}
					const target = z.object({ targetId: id }).safeParse(output);
					if (!target.success) break;
					if (call.name === 'reply_to_message') {
						const reply = z.object({ message: z.string().min(1).max(8000) }).parse(output);
						writer.write({ type: 'data-coach-reply', id: callId, data: target.data });
						const textId = `${turnId}:reply:${callId}`;
						writer.write({ type: 'text-start', id: textId });
						writer.write({ type: 'text-delta', id: textId, delta: reply.message });
						writer.write({ type: 'text-end', id: textId });
					} else {
						const reaction = z
							.object({ emoji: z.enum(['❤️', '👍', '👎', '😂', '🎉']) })
							.parse(output);
						writer.write({
							type: 'data-coach-reaction',
							id: callId,
							data: { ...target.data, ...reaction }
						});
					}
					break;
				}
				if (interactiveTools.has(call.name) || writeTools.has(call.name)) {
					if (outcome !== 'completed' || pendingCard) break;
					pendingCard = true;
					writer.write({
						type: 'tool-input-available',
						toolName: call.name,
						toolCallId: call.id,
						input: call.input
					});
					if (writeTools.has(call.name)) {
						writer.write({
							type: 'tool-approval-request',
							toolCallId: call.id,
							approvalId: randomUUID()
						});
					}
					break;
				}
				if (outcome !== 'completed') {
					writer.write({
						type: 'tool-output-error',
						toolCallId: call.id,
						errorText: 'Pip could not complete that tool call.',
						providerExecuted: true
					});
					break;
				}
				let uiOutput = output;
				if (call.name === 'open_physics_sim' || call.name === 'open_math_explorer') {
					const usd = await getEveToolRecord<number>(turnId, `simulation-spend:${callId}`);
					if (usd) input.onSimulationUsage(usd);
					uiOutput = (await getEveToolRecord(turnId, `simulation:${callId}`)) ?? {
						error: 'Simulation unavailable.'
					};
				}
				writer.write({
					type: 'tool-output-available',
					toolCallId: call.id,
					output: uiOutput ?? null,
					providerExecuted: true
				});
				break;
			}
			case 'usage.recorded': {
				const runId = event.data.owner?.runId;
				if (runId) {
					if (meteredRuns.has(runId)) break;
					meteredRuns.add(runId);
				}
				const { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } = event.data.usage;
				input.onUsage({
					inputTokens,
					outputTokens,
					totalTokens: inputTokens + outputTokens,
					inputTokenDetails: {
						noCacheTokens: Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens),
						cacheReadTokens,
						cacheWriteTokens
					},
					outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined }
				});
				break;
			}
			case 'delivery.settled':
				handled = event.data.outcome === 'handled';
				break;
		}
	}
	if (!handled) throw new Error('Eve did not complete the delivery');
}
