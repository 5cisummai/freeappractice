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

function normalize(value: unknown): unknown {
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: value.stack,
			cause: value.cause ? normalize(value.cause) : undefined
		};
	}

	if (Array.isArray(value)) {
		return value.map((entry) => normalize(entry));
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
				key,
				normalize(entry)
			])
		);
	}

	return value;
}

function formatMeta(meta: unknown): string {
	return inspect(normalize(meta), {
		colors: true,
		depth: 5,
		compact: false,
		breakLength: 100,
		sorted: true
	});
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

	if (isDev) {
		const color = LEVEL_COLORS[level];
		const metaStr = typeof meta === 'undefined' ? '' : `\n${formatMeta(meta)}`;
		const consoleFn =
			level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
		consoleFn(`${color}${ts}${RESET} ${BOLD}[${level.toUpperCase()}]${RESET} ${message}${metaStr}`);
	} else {
		console.log(JSON.stringify({ ts, level, message, meta: normalize(meta) }));
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
