const baseUrl = process.env.SMOKE_BASE_URL?.trim();
const className = process.env.SMOKE_CLASS?.trim() || 'AP Biology';
const unit = process.env.SMOKE_UNIT?.trim() || '';
const maxAttempts = Number(process.env.SMOKE_MAX_ATTEMPTS || 4);

if (!baseUrl) {
	throw new Error('SMOKE_BASE_URL is required, for example https://staging.example.com');
}

const smokeBase = new URL(baseUrl);
smokeBase.pathname = smokeBase.pathname.replace(/\/$/, '');

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseQuestionPayload(response: JsonRecord): JsonRecord {
	let payload: unknown = response.answer ?? response;

	if (typeof payload === 'string') {
		const raw = payload
			.replace(/^```(?:json)?\s*/i, '')
			.replace(/\s*```$/, '')
			.trim();
		payload = JSON.parse(raw);
	}

	if (!isRecord(payload)) {
		throw new Error('Question response did not contain an object payload');
	}

	return payload;
}

function getOptionLabels(payload: JsonRecord): string[] {
	if (Array.isArray(payload.options)) {
		return payload.options
			.map((option, index) => {
				if (typeof option === 'string') return String.fromCharCode(65 + index);
				return isRecord(option)
					? String(option.id ?? option.label ?? String.fromCharCode(65 + index)).toUpperCase()
					: '';
			})
			.filter(Boolean);
	}

	return ['A', 'B', 'C', 'D'].filter((letter) => {
		const value = payload[`option${letter}`];
		return typeof value === 'string' && value.trim().length > 0;
	});
}

async function readJson(response: Response): Promise<JsonRecord> {
	const value: unknown = await response.json();
	if (!isRecord(value)) throw new Error('Response was not a JSON object');
	return value;
}

async function getPage(): Promise<void> {
	const response = await fetch(new URL('/practice/ap-biology', smokeBase));
	if (!response.ok) throw new Error(`Practice page returned HTTP ${response.status}`);

	const html = await response.text();
	for (const marker of ['AP Biology', 'Generate Question']) {
		if (!html.includes(marker)) throw new Error(`Practice page is missing: ${marker}`);
	}
}

async function requestQuestion(): Promise<{ response: JsonRecord; attempts: number }> {
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const httpResponse = await fetch(new URL('/api/question', smokeBase), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ className, unit })
		});
		const response = await readJson(httpResponse);

		if (httpResponse.status !== 503 || response.code !== 'POOL_WARMING') {
			if (!httpResponse.ok) {
				throw new Error(
					`Question API returned HTTP ${httpResponse.status}: ${String(response.error ?? 'unknown error')}`
				);
			}
			return { response, attempts: attempt };
		}

		if (attempt === maxAttempts) break;
		const retryAfter = Math.max(1, Number(response.retryAfterSeconds) || 1);
		console.log(`Question pool is warming; retrying in ${retryAfter}s`);
		await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
	}

	throw new Error(`Question pool remained unavailable after ${maxAttempts} attempts`);
}

await getPage();
const { response, attempts } = await requestQuestion();
const payload = parseQuestionPayload(response);
const questionPrompt = String(payload.question ?? payload.prompt ?? '').trim();
const optionLabels = getOptionLabels(payload);
const correctAnswer = String(payload.correctAnswer ?? payload.answer ?? '')
	.toUpperCase()
	.match(/\b[A-D]\b/)?.[0];
const questionId = String(response.questionId ?? payload.questionId ?? '').trim();

if (!questionPrompt) throw new Error('Question payload is missing a prompt');
if (
	optionLabels.length !== 4 ||
	!['A', 'B', 'C', 'D'].every((label) => optionLabels.includes(label))
) {
	throw new Error(
		`Question payload must contain four A–D choices; received ${optionLabels.join(', ')}`
	);
}
if (!correctAnswer) throw new Error('Question payload is missing a correct answer');
if (!questionId) throw new Error('Question response is missing questionId');

console.log(
	`Question smoke passed: ${className}${unit ? ` / ${unit}` : ''} (${questionId}, ${attempts} attempt${attempts === 1 ? '' : 's'})`
);

export {};
