/**
 * One-shot AI Gateway smoke tests for local verification.
 * Usage: bun --preload ./scripts/bun-sveltekit-env-preload.ts scripts/smoke-ai-gateway.ts
 */
import { embed, generateText, Output, ToolLoopAgent, isStepCount } from 'ai';
import { z } from 'zod';
import { COACH_MODEL } from '$lib/agent/model';
import { SIM_MODEL } from '$lib/agent/tools/simulation.server';
import { CONVERSATION_TITLE_MODEL } from '$lib/agent/conversations/titles.server';
import { MCQ_GENERATION_MODEL } from '$lib/question-bank/mcq/generation.server';
import { QUESTION_QUALITY_MODEL } from '$lib/question-bank/quality/dashboard.server';
import { MEM0_LLM_MODEL, MEM0_EMBEDDING_MODEL } from '$lib/agent/memory/service.server';
import { TUTOR_MODEL } from '$lib/tutor/service.server';
import {
	AI_GATEWAY_BASE_URL,
	requireGatewayCredential
} from '$lib/server/gateway-credentials.server';

type Result = { name: string; ok: boolean; detail: string; ms: number };

async function timed(name: string, fn: () => Promise<string>): Promise<Result> {
	const started = Date.now();
	try {
		const detail = await fn();
		return { name, ok: true, detail, ms: Date.now() - started };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { name, ok: false, detail: message.slice(0, 240), ms: Date.now() - started };
	}
}

async function main() {
	requireGatewayCredential();
	const results: Result[] = [];

	results.push(
		await timed('tutor generateText', async () => {
			const { text, usage } = await generateText({
				model: TUTOR_MODEL,
				prompt: 'Reply with exactly: tutor-ok',
				maxOutputTokens: 32
			});
			if (!/tutor-ok/i.test(text)) throw new Error(`unexpected text: ${text.slice(0, 80)}`);
			return `${TUTOR_MODEL} out=${usage.outputTokens ?? 0}`;
		})
	);

	results.push(
		await timed('coach generateText', async () => {
			const { text } = await generateText({
				model: COACH_MODEL,
				prompt: 'Reply with exactly: coach-ok',
				maxOutputTokens: 32
			});
			if (!/coach-ok/i.test(text)) throw new Error(`unexpected text: ${text.slice(0, 80)}`);
			return COACH_MODEL;
		})
	);

	results.push(
		await timed('title generateText', async () => {
			const { text } = await generateText({
				model: CONVERSATION_TITLE_MODEL,
				instructions:
					'Write a short conversation title for this student message. 3 to 5 words. Return only the title. No quotes.',
				prompt: 'student asks about AP Biology cells',
				maxOutputTokens: 64,
				providerOptions: { openai: { forceReasoning: true, reasoningEffort: 'low' } }
			});
			if (!text.trim()) throw new Error('empty title');
			return `"${text.trim().slice(0, 60)}"`;
		})
	);

	results.push(
		await timed('sim generateText', async () => {
			const { text } = await generateText({
				model: SIM_MODEL,
				prompt: 'Reply with exactly: sim-ok',
				maxOutputTokens: 32
			});
			if (!/sim-ok/i.test(text)) throw new Error(`unexpected text: ${text.slice(0, 80)}`);
			return SIM_MODEL;
		})
	);

	results.push(
		await timed('structured output', async () => {
			const schema = z.object({
				ok: z.boolean(),
				label: z.string()
			});
			const { output: parsed } = await generateText({
				model: MCQ_GENERATION_MODEL,
				instructions: 'Return a tiny JSON object. Set ok=true and label="structured-ok".',
				prompt: 'Produce the object now.',
				output: Output.object({ schema, name: 'smoke_object' }),
				providerOptions: { openai: { reasoningEffort: 'low' } }
			});
			if (!parsed.ok || !/structured-ok/i.test(parsed.label)) {
				throw new Error(`bad parse: ${JSON.stringify(parsed)}`);
			}
			return MCQ_GENERATION_MODEL;
		})
	);

	results.push(
		await timed('quality model ToolLoopAgent', async () => {
			const agent = new ToolLoopAgent({
				model: QUESTION_QUALITY_MODEL,
				instructions: 'Reply briefly.',
				stopWhen: isStepCount(1),
				output: Output.object({
					name: 'smoke_quality',
					schema: z.object({ status: z.string() })
				})
			});
			const result = await agent.generate({ prompt: 'Return status="quality-ok".' });
			if (!result.output || !/quality-ok/i.test(result.output.status)) {
				throw new Error(`bad output: ${JSON.stringify(result.output)}`);
			}
			return QUESTION_QUALITY_MODEL;
		})
	);

	results.push(
		await timed('mem0 llm generateText', async () => {
			const { text } = await generateText({
				model: MEM0_LLM_MODEL,
				prompt: 'Reply with exactly: mem0-llm-ok',
				maxOutputTokens: 32
			});
			if (!/mem0-llm-ok/i.test(text)) throw new Error(`unexpected text: ${text.slice(0, 80)}`);
			return MEM0_LLM_MODEL;
		})
	);

	results.push(
		await timed('mem0 embeddings', async () => {
			const { embedding, usage } = await embed({
				model: MEM0_EMBEDDING_MODEL,
				value: 'AP Biology cell membrane smoke test'
			});
			if (!Array.isArray(embedding) || embedding.length < 100) {
				throw new Error(`bad embedding length: ${embedding?.length}`);
			}
			return `${MEM0_EMBEDDING_MODEL} dims=${embedding.length} tokens=${usage.tokens ?? '?'}`;
		})
	);

	results.push(
		await timed('gateway OpenAI-compatible /models', async () => {
			const key = requireGatewayCredential();
			const res = await fetch(`${AI_GATEWAY_BASE_URL}/models`, {
				headers: { Authorization: `Bearer ${key}` }
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const body = (await res.json()) as { data?: unknown[] };
			return `${body.data?.length ?? 0} models`;
		})
	);

	const failed = results.filter((r) => !r.ok);
	for (const r of results) {
		console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.ms}ms)  ${r.detail}`);
	}
	console.log(
		failed.length === 0
			? `\nALL ${results.length} AI smoke checks passed`
			: `\n${failed.length}/${results.length} failed`
	);
	process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
