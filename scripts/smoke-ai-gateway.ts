/**
 * One-shot AI Gateway smoke tests for local verification.
 * Usage: bun --preload ./scripts/bun-sveltekit-env-preload.ts scripts/smoke-ai-gateway.ts
 */
import { embed, generateText, Output, ToolLoopAgent, isStepCount } from 'ai';
import { z } from 'zod';
import {
	COACH_MODEL,
	CONVERSATION_TITLE_MODEL,
	MCQ_GENERATION_MODEL,
	MEM0_EMBEDDING_MODEL,
	MEM0_LLM_MODEL,
	QUESTION_QUALITY_MODEL,
	SIM_MODEL,
	TUTOR_MODEL
} from '../src/lib/ai/ai-models-config';
import { AI_GATEWAY_BASE_URL, gatewayModel, requireGatewayCredential } from '../src/lib/ai/gateway.server';
import { structuredObject } from '../src/lib/ai/service.server';

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
				model: gatewayModel(TUTOR_MODEL),
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
				model: gatewayModel(COACH_MODEL),
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
				model: gatewayModel(CONVERSATION_TITLE_MODEL),
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
				model: gatewayModel(SIM_MODEL),
				prompt: 'Reply with exactly: sim-ok',
				maxOutputTokens: 32
			});
			if (!/sim-ok/i.test(text)) throw new Error(`unexpected text: ${text.slice(0, 80)}`);
			return SIM_MODEL;
		})
	);

	results.push(
		await timed('structuredObject (MCQ path)', async () => {
			const schema = z.object({
				ok: z.boolean(),
				label: z.string()
			});
			const { parsed, model } = await structuredObject({
				callName: 'smokeStructured',
				model: MCQ_GENERATION_MODEL,
				system: 'Return a tiny JSON object. Set ok=true and label="structured-ok".',
				user: 'Produce the object now.',
				schema,
				schemaName: 'smoke_object',
				reasoningEffort: 'low'
			});
			if (!parsed.ok || !/structured-ok/i.test(parsed.label)) {
				throw new Error(`bad parse: ${JSON.stringify(parsed)}`);
			}
			return model;
		})
	);

	results.push(
		await timed('quality model ToolLoopAgent', async () => {
			const agent = new ToolLoopAgent({
				model: gatewayModel(QUESTION_QUALITY_MODEL),
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
				model: gatewayModel(MEM0_LLM_MODEL),
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
				model: gatewayModel(MEM0_EMBEDDING_MODEL),
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
	console.log(failed.length === 0 ? `\nALL ${results.length} AI smoke checks passed` : `\n${failed.length}/${results.length} failed`);
	process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
