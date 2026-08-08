/**
 * Batch bake-off for the AP-specialist agent. This never writes production labels.
 * It uses existing AP-specialist human decisions as a stratified gold set.
 *
 *   bun run quality:eval --submit --max 200 --state .question-quality-eval.json
 *   bun run quality:eval --refresh --state .question-quality-eval.json
 */
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import { buildBatchLine } from '../src/lib/question-quality/batch-line';
import { extractResponseOutputText } from '../src/lib/question-quality/rubric.server';

type GoldItem = { questionId: string; verdict: 'good' | 'bad'; apClass: string };
type Candidate = {
	model: string;
	effort: 'low' | 'medium';
	inputUsdPerMillion: number;
	outputUsdPerMillion: number;
};
type EvalRun = Candidate & { batchId: string; inputFileId: string; status: string };
type EvalReport = {
	model: string;
	effort: string;
	costUsd: number;
	goodPrecision: number;
	agreement: number;
	schemaCompliance: number;
	escalationRate: number;
	inputTokens: number;
	outputTokens: number;
	passes: boolean;
	byCourse: Record<string, { count: number; agreement: number }>;
};
type EvalState = { createdAt: string; gold: GoldItem[]; runs: EvalRun[]; reports?: EvalReport[] };

const candidates: Candidate[] = [
	{
		model: 'gpt-5.6-luna',
		effort: 'medium',
		inputUsdPerMillion: 0.25,
		outputUsdPerMillion: 1.5
	},
	{
		model: 'gpt-5.6-terra',
		effort: 'low',
		inputUsdPerMillion: 0.625,
		outputUsdPerMillion: 3.75
	},
	{
		model: 'gpt-5.6-terra',
		effort: 'medium',
		inputUsdPerMillion: 0.625,
		outputUsdPerMillion: 3.75
	},
	{
		model: 'gpt-5.6-sol',
		effort: 'low',
		inputUsdPerMillion: 1.25,
		outputUsdPerMillion: 7.5
	},
	{
		model: 'gpt-5.6-sol',
		effort: 'medium',
		inputUsdPerMillion: 1.25,
		outputUsdPerMillion: 7.5
	}
];
const args = process.argv.slice(2);
const statePath = valueAfter('--state') || '.question-quality-eval.json';
const apiKey = process.env.OPEN_AI_KEY?.trim();
const databaseUri = process.env.DATABASE_URI?.trim();
const bucket = process.env.AWS_S3_BUCKET?.trim();
if (!apiKey || !databaseUri || !bucket) {
	throw new Error('OPEN_AI_KEY, DATABASE_URI, and AWS_S3_BUCKET are required');
}

function valueAfter(flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

function s3Client(): S3Client {
	return new S3Client({
		region: process.env.AWS_REGION,
		...(process.env.AWS_S3_ENDPOINT
			? {
					endpoint: process.env.AWS_S3_ENDPOINT,
					forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true'
				}
			: {}),
		...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
			? {
					credentials: {
						accessKeyId: process.env.AWS_ACCESS_KEY_ID,
						secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
						...(process.env.AWS_SESSION_TOKEN
							? { sessionToken: process.env.AWS_SESSION_TOKEN }
							: {})
					}
				}
			: {})
	});
}

async function openAi(path: string, init: RequestInit = {}): Promise<Response> {
	const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
	const response = await fetch(`${base}${path}`, {
		...init,
		headers: { Authorization: `Bearer ${apiKey}`, ...init.headers }
	});
	if (!response.ok) throw new Error(`OpenAI ${path} failed: ${await response.text()}`);
	return response;
}

async function upload(contents: string, name: string): Promise<string> {
	const form = new FormData();
	form.set('purpose', 'batch');
	form.set('file', new Blob([contents], { type: 'application/jsonl' }), name);
	return ((await (await openAi('/files', { method: 'POST', body: form })).json()) as { id: string })
		.id;
}

async function createBatch(inputFileId: string, candidate: Candidate): Promise<string> {
	const response = await openAi('/batches', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			input_file_id: inputFileId,
			endpoint: '/v1/responses',
			completion_window: '24h',
			metadata: { purpose: 'question-quality-calibration', effort: candidate.effort }
		})
	});
	return ((await response.json()) as { id: string }).id;
}

function stratified(items: GoldItem[], maximum: number): GoldItem[] {
	const groups = new Map<string, GoldItem[]>();
	for (const item of items) groups.set(item.apClass, [...(groups.get(item.apClass) ?? []), item]);
	const result: GoldItem[] = [];
	while (result.length < maximum && [...groups.values()].some((group) => group.length)) {
		for (const group of groups.values()) {
			const item = group.shift();
			if (item) result.push(item);
			if (result.length >= maximum) break;
		}
	}
	return result;
}

async function submit() {
	const maximum = Math.min(500, Math.max(20, Number(valueAfter('--max') || '200')));
	await mongoose.connect(databaseUri!);
	const raw = (await mongoose.connection
		.collection('question_quality')
		.find({
			'humanAssessment.verdict': { $in: ['good', 'bad'] },
			'humanAssessment.blind': true
		})
		.project({ questionId: 1, apClass: 1, 'humanAssessment.verdict': 1 })
		.limit(2_000)
		.toArray()) as Array<{
		questionId: string;
		apClass?: string;
		humanAssessment: { verdict: 'good' | 'bad' };
	}>;
	const gold = stratified(
		raw.map((row) => ({
			questionId: row.questionId,
			verdict: row.humanAssessment.verdict,
			apClass: row.apClass || 'Unknown'
		})),
		maximum
	);
	if (gold.length < 100) {
		throw new Error(
			`At least 100 human-reviewed gold questions are required; found ${gold.length}`
		);
	}
	const s3 = s3Client();
	const questions = new Map<string, Record<string, unknown>>();
	for (const item of gold) {
		const response = await s3.send(
			new GetObjectCommand({ Bucket: bucket, Key: `questions/${item.questionId}.json` })
		);
		if (!response.Body) throw new Error(`Missing S3 question ${item.questionId}`);
		questions.set(item.questionId, JSON.parse(await response.Body.transformToString()));
	}
	const runs: EvalRun[] = [];
	for (const candidate of candidates) {
		const contents = gold
			.map((item) =>
				buildBatchLine({
					questionId: item.questionId,
					question: questions.get(item.questionId)!,
					model: candidate.model,
					reasoningEffort: candidate.effort,
					maxOutputTokens: 800,
					webSearchContextSize: 'high'
				})
			)
			.join('\n');
		const inputFileId = await upload(
			contents,
			`question-quality-eval-${candidate.model}-${candidate.effort}.jsonl`
		);
		const batchId = await createBatch(inputFileId, candidate);
		runs.push({ ...candidate, inputFileId, batchId, status: 'validating' });
		console.log(`Submitted ${candidate.model}/${candidate.effort}: ${batchId}`);
	}
	await writeFile(
		statePath,
		JSON.stringify({ createdAt: new Date().toISOString(), gold, runs }, null, 2)
	);
	await mongoose.disconnect();
	console.log(`Saved evaluation state to ${statePath}`);
}

async function refresh() {
	const state = JSON.parse(await readFile(statePath, 'utf8')) as EvalState;
	const gold = new Map(state.gold.map((item) => [item.questionId, item.verdict]));
	const reports: EvalReport[] = [];
	for (const run of state.runs) {
		const batch = (await (await openAi(`/batches/${run.batchId}`)).json()) as {
			status: string;
			output_file_id?: string;
		};
		run.status = batch.status;
		console.log(`${run.model}/${run.effort}: ${batch.status}`);
		if (batch.status !== 'completed' || !batch.output_file_id) continue;
		const output = await (await openAi(`/files/${batch.output_file_id}/content`)).text();
		let valid = 0;
		let matches = 0;
		let predictedGood = 0;
		let trueGood = 0;
		let escalations = 0;
		let inputTokens = 0;
		let outputTokens = 0;
		const byCourseCounts = new Map<string, { count: number; matches: number }>();
		for (const line of output.split('\n').filter(Boolean)) {
			try {
				const row = JSON.parse(line) as {
					custom_id: string;
					response: {
						body: { usage?: { input_tokens?: number; output_tokens?: number } };
					};
				};
				const prediction = JSON.parse(extractResponseOutputText(row.response.body)) as {
					verdict: 'good' | 'bad';
					requires_human_review?: boolean;
				};
				if (prediction.verdict !== 'good' && prediction.verdict !== 'bad') continue;
				valid += 1;
				const expected = gold.get(row.custom_id);
				const matched = prediction.verdict === expected;
				if (matched) matches += 1;
				if (prediction.requires_human_review) escalations += 1;
				inputTokens += row.response.body.usage?.input_tokens ?? 0;
				outputTokens += row.response.body.usage?.output_tokens ?? 0;
				const course =
					state.gold.find((item) => item.questionId === row.custom_id)?.apClass ?? 'Unknown';
				const courseCounts = byCourseCounts.get(course) ?? { count: 0, matches: 0 };
				courseCounts.count += 1;
				if (matched) courseCounts.matches += 1;
				byCourseCounts.set(course, courseCounts);
				if (prediction.verdict === 'good') {
					predictedGood += 1;
					if (expected === 'good') trueGood += 1;
				}
			} catch {
				// Counted as schema non-compliance.
			}
		}
		const goodPrecision = predictedGood ? trueGood / predictedGood : 0;
		const agreement = matches / state.gold.length;
		const schemaCompliance = valid / state.gold.length;
		const byCourse = Object.fromEntries(
			[...byCourseCounts.entries()].map(([course, counts]) => [
				course,
				{ count: counts.count, agreement: counts.matches / counts.count }
			])
		);
		reports.push({
			model: run.model,
			effort: run.effort,
			costUsd:
				(inputTokens / 1_000_000) * run.inputUsdPerMillion +
				(outputTokens / 1_000_000) * run.outputUsdPerMillion,
			goodPrecision,
			agreement,
			schemaCompliance,
			escalationRate: valid ? escalations / valid : 0,
			inputTokens,
			outputTokens,
			passes: goodPrecision >= 0.95 && agreement >= 0.9 && schemaCompliance >= 0.99,
			byCourse
		});
	}
	state.reports = reports;
	await writeFile(statePath, JSON.stringify(state, null, 2));
	console.table(reports);
	const winner = reports.filter((report) => report.passes).sort((a, b) => a.costUsd - b.costUsd)[0];
	if (winner) {
		console.log(`Cheapest passing configuration: ${winner.model}/${winner.effort}`);
		console.log('After AP-specialist signoff, bind production to this exact configuration:');
		console.log(`QUESTION_QUALITY_MODEL=${winner.model}`);
		console.log(`QUESTION_QUALITY_REASONING_EFFORT=${winner.effort}`);
		console.log(`QUESTION_QUALITY_CALIBRATED_MODEL=${winner.model}`);
		console.log('QUESTION_QUALITY_CALIBRATED_RUBRIC=ap-quality-v2');
		console.log(`QUESTION_QUALITY_CALIBRATED_REASONING_EFFORT=${winner.effort}`);
		console.log('QUESTION_QUALITY_AGENT_CALIBRATED=true');
	} else if (reports.length === state.runs.length) {
		console.log('No candidate passed. Keep the production system in human-only mode.');
	}
}

if (args.includes('--submit')) await submit();
else if (args.includes('--refresh')) await refresh();
else throw new Error('Use --submit or --refresh');
