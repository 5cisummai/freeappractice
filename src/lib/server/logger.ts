/**
 * Structured server-side logger.
 * - Development: colourised, human-readable output.
 * - Production:  newline-delimited JSON (compatible with most log aggregators).
 */

import { inspect } from 'node:util';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = process.env.NODE_ENV !== 'production';

const LEVEL_COLORS: Record<LogLevel, string> = {
	debug: '\x1b[90m', // gray
	info: '\x1b[36m', // cyan
	warn: '\x1b[33m', // yellow
	error: '\x1b[31m' // red
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const MAX_DEPTH = 5;
const MAX_OBJECT_KEYS = 32;
const MAX_ARRAY_LENGTH = 32;
const MAX_STRING_LENGTH = 500;
const MAX_ERROR_STACK_LENGTH = 2_000;
const MAX_META_OUTPUT_LENGTH = 8_000;
const MAX_LOG_OUTPUT_LENGTH = 12_000;
const REDACTED = '[REDACTED]';
const TRUNCATED = '[TRUNCATED]';

const SENSITIVE_KEY_PATTERN =
	/(?:password|passcode|secret|token|authorization|cookie|session|api[-_]?key|private[-_]?key|client[-_]?secret|refresh[-_]?token|access[-_]?token|user[-_]?id|stripe[-_]?(?:customer|subscription)[-_]?id|email|e[-_]?mail|ip(?:[-_]?address)?|request[-_]?body|response[-_]?body|raw[-_]?body|prompt|system[-_]?prompt|user[-_]?message|generated[-_]?text|output[-_]?text|completion[-_]?text|narrative|(?:^|[-_])(text|content|body|answer|output|message|response)$)/i;

const SAFE_OPERATIONAL_KEYS = new Set([
	'promptTokens',
	'completionTokens',
	'inputTokens',
	'outputTokens',
	'reasoningTokens',
	'cachedTokens',
	'totalTokens'
]);

/** Error-shaped fields allowed under an `error` key (dev debugging). */
const ERROR_DETAIL_KEYS = new Set([
	'message',
	'name',
	'stack',
	'cause',
	'code',
	'status',
	'statusCode',
	'errno',
	'syscall',
	'type'
]);

const SENSITIVE_VALUE_PATTERNS = [
	/^bearer\s+/i,
	/^basic\s+/i,
	/^(?:sk|rk|ghp|github_pat|xox[baprs])-[_a-zA-Z0-9-]+$/,
	/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/
];

type NormalizeState = {
	seen: WeakSet<object>;
};

function boundString(value: string, maxLength = MAX_STRING_LENGTH): string {
	return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function isSensitiveValue(value: string): boolean {
	return (
		SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value)) ||
		/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
	);
}

function isSensitiveKey(key: string, parentKey?: string): boolean {
	if (parentKey === 'error' && ERROR_DETAIL_KEYS.has(key)) {
		return false;
	}
	return SENSITIVE_KEY_PATTERN.test(key) && !SAFE_OPERATIONAL_KEYS.has(key);
}

function extractError(meta: unknown): Error | undefined {
	if (!meta || typeof meta !== 'object') return undefined;
	const candidate = (meta as Record<string, unknown>).error;
	return candidate instanceof Error ? candidate : undefined;
}

function normalize(
	value: unknown,
	depth = 0,
	state: NormalizeState = { seen: new WeakSet() },
	parentKey?: string
): unknown {
	if (typeof value === 'string') {
		return isSensitiveValue(value) ? REDACTED : boundString(value);
	}

	if (typeof value === 'bigint') return boundString(value.toString());
	if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
	if (typeof value === 'undefined') return undefined;
	if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`;

	if (depth >= MAX_DEPTH) return TRUNCATED;
	if (state.seen.has(value as object)) return '[Circular]';
	state.seen.add(value as object);

	if (value instanceof Error) {
		return {
			name: boundString(value.name, 100),
			message: normalize(value.message, depth + 1, state, 'message'),
			stack: value.stack ? boundString(value.stack, MAX_ERROR_STACK_LENGTH) : undefined,
			...(value.cause !== undefined ? { cause: normalize(value.cause, depth + 1, state, 'cause') } : {})
		};
	}

	if (value instanceof Date) return value.toISOString();

	if (Array.isArray(value)) {
		const entries = value
			.slice(0, MAX_ARRAY_LENGTH)
			.map((entry) => normalize(entry, depth + 1, state, parentKey));
		if (value.length > MAX_ARRAY_LENGTH)
			entries.push(`${TRUNCATED} ${value.length - MAX_ARRAY_LENGTH} more`);
		return entries;
	}

	const entries = Object.entries(value as Record<string, unknown>);
	const normalized: Record<string, unknown> = {};
	for (const [key, entry] of entries.slice(0, MAX_OBJECT_KEYS)) {
		normalized[boundString(key, 100)] = isSensitiveKey(key, parentKey)
			? REDACTED
			: normalize(entry, depth + 1, state, key);
	}
	if (entries.length > MAX_OBJECT_KEYS)
		normalized._truncatedKeys = entries.length - MAX_OBJECT_KEYS;
	return normalized;
}

function boundedMeta(meta: unknown): unknown {
	const normalized = normalize(meta);
	try {
		if (JSON.stringify(normalized).length <= MAX_META_OUTPUT_LENGTH) return normalized;
	} catch {
		return { error: 'Unable to serialize log metadata' };
	}
	return { truncated: true };
}

function formatMeta(meta: unknown): string {
	const formatted = inspect(boundedMeta(meta), {
		colors: true,
		depth: MAX_DEPTH,
		compact: false,
		breakLength: 100,
		sorted: true
	});
	return formatted.length > MAX_META_OUTPUT_LENGTH
		? `${formatted.slice(0, MAX_META_OUTPUT_LENGTH)}… ${TRUNCATED}`
		: formatted;
}

function toLogObject(value: unknown): Record<string, unknown> {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}

	if (typeof value === 'undefined') {
		return {};
	}

	return { result: value };
}

function write(level: LogLevel, message: string, meta?: unknown): void {
	const ts = new Date().toISOString();
	const safeMessage = boundString(message);

	if (isDev) {
		const color = LEVEL_COLORS[level];
		const metaStr = typeof meta === 'undefined' ? '' : `\n${formatMeta(meta)}`;
		const consoleFn =
			level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
		consoleFn(
			`${color}${ts}${RESET} ${BOLD}[${level.toUpperCase()}]${RESET} ${safeMessage}${metaStr}`
		);
		if (level === 'error') {
			const err = extractError(meta);
			if (err?.stack) {
				console.error(err.stack);
			}
		}
	} else {
		const record = { ts, level, message: safeMessage, meta: boundedMeta(meta) };
		const serialized = JSON.stringify(record);
		console.log(
			serialized.length <= MAX_LOG_OUTPUT_LENGTH
				? serialized
				: JSON.stringify({ ...record, meta: { truncated: true } })
		);
	}
}

export const logger = {
	debug: (message: string, meta?: unknown) => write('debug', message, meta),
	info: (message: string, meta?: unknown) => write('info', message, meta),
	warn: (message: string, meta?: unknown) => write('warn', message, meta),
	error: (message: string, meta?: unknown) => write('error', message, meta),

	/**
	 * Log the start of an AI provider call.
	 * Returns a function to call on completion with the result details.
	 */
	aiCall(service: string, model: string, meta?: unknown): (result?: unknown) => void {
		const start = Date.now();
		write('info', `[ai] ${service} → ${model} started`, meta);
		return (result?: unknown) => {
			const durationMs = Date.now() - start;
			write('info', `[ai] ${service} → ${model} completed in ${durationMs}ms`, {
				durationMs,
				...toLogObject(result)
			});
		};
	}
};
