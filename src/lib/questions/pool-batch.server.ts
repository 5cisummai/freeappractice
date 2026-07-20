import { env } from '$env/dynamic/private';
import {
	createOpenAiBatch,
	downloadOpenAiFile,
	retrieveOpenAiBatch,
	uploadBatchInput
} from '$lib/question-quality/openai-batch.server';
import { buildMcqPoolBatchLine } from '$lib/questions/pool-batch-line';
import { GENERATION_MODEL } from '$lib/ai/service.server';

export { downloadOpenAiFile, retrieveOpenAiBatch };

export type PoolBatchManifestEntry = {
	apClass: string;
	unit: string;
};

export type PoolBatchManifest = {
	purpose: 'question-pool-mcq';
	model: string;
	createdAt: string;
	entries: Record<string, PoolBatchManifestEntry>;
};

export function getPoolBatchGenerationModel(): string {
	return env.GENERATION_MODEL?.trim() || GENERATION_MODEL;
}

export function buildMcqPoolBatchJsonl(opts: {
	requests: Array<{
		customId: string;
		apClass: string;
		unit: string;
		recentTopics?: string[];
	}>;
	model?: string;
	reasoningEffort?: 'low' | 'medium' | 'high';
}): { jsonl: string; manifest: PoolBatchManifest } {
	const model = opts.model ?? getPoolBatchGenerationModel();
	const lines: string[] = [];
	const entries: Record<string, PoolBatchManifestEntry> = {};

	for (const req of opts.requests) {
		lines.push(
			buildMcqPoolBatchLine({
				customId: req.customId,
				className: req.apClass,
				unit: req.unit,
				recentTopics: req.recentTopics,
				model,
				reasoningEffort: opts.reasoningEffort
			})
		);
		entries[req.customId] = { apClass: req.apClass, unit: req.unit };
	}

	return {
		jsonl: `${lines.join('\n')}\n`,
		manifest: {
			purpose: 'question-pool-mcq',
			model,
			createdAt: new Date().toISOString(),
			entries
		}
	};
}

export async function submitMcqPoolBatch(opts: {
	jsonl: string;
	idempotencyKey: string;
	filename?: string;
}): Promise<{ batchId: string; status: string; inputFileId: string }> {
	const inputFileId = await uploadBatchInput(
		opts.jsonl,
		opts.filename ?? `pool-mcq-${Date.now()}.jsonl`
	);
	const batch = await createOpenAiBatch({
		inputFileId,
		idempotencyKey: opts.idempotencyKey,
		metadata: { purpose: 'question-pool-mcq' }
	});
	return { batchId: batch.id, status: batch.status, inputFileId };
}

/** Extract structured JSON text from a `/v1/responses` batch result body. */
export function extractPoolBatchOutputText(body: unknown): string {
	const response = body as {
		output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
		output_text?: string;
	};
	if (typeof response.output_text === 'string' && response.output_text.trim()) {
		return response.output_text;
	}
	for (const item of response.output ?? []) {
		for (const content of item.content ?? []) {
			if (content.type === 'output_text' && content.text) return content.text;
		}
	}
	throw new Error('OpenAI response did not contain output_text');
}
