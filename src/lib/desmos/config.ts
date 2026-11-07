export const DESMOS_CALCULATOR_API_VERSION = 'v1.12';

export const DESMOS_SANDBOX_ERROR_CODES = ['missing_api_key', 'script_load', 'init'] as const;

export type DesmosSandboxErrorCode = (typeof DESMOS_SANDBOX_ERROR_CODES)[number];

export type DesmosSandboxReadyMessage = { type: 'ready' };

export type DesmosSandboxErrorMessage = {
	type: 'error';
	code: DesmosSandboxErrorCode;
	message: string;
};

export type DesmosSandboxMessage = DesmosSandboxReadyMessage | DesmosSandboxErrorMessage;

export function resolveDesmosApiKey(value: string | undefined): string | null {
	const apiKey = value?.trim();
	return apiKey ? apiKey : null;
}

export function desmosCalculatorScriptUrl(apiKey: string): string {
	return `https://www.desmos.com/api/${DESMOS_CALCULATOR_API_VERSION}/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
}

export function desmosUserMessage(code: DesmosSandboxErrorCode): string {
	switch (code) {
		case 'missing_api_key':
			return 'The calculator is temporarily unavailable.';
		case 'script_load':
			return 'Could not load the calculator.';
		case 'init':
			return 'Could not start the calculator.';
		default: {
			const _exhaustive: never = code;
			return _exhaustive;
		}
	}
}

export function desmosErrorHint(code: DesmosSandboxErrorCode): string | null {
	switch (code) {
		case 'missing_api_key':
			return null;
		case 'script_load':
		case 'init':
			return 'Check your network connection and try again.';
		default: {
			const _exhaustive: never = code;
			return _exhaustive;
		}
	}
}

export function desmosSandboxError(code: DesmosSandboxErrorCode): DesmosSandboxErrorMessage {
	return { type: 'error', code, message: desmosUserMessage(code) };
}

function isDesmosSandboxErrorCode(value: unknown): value is DesmosSandboxErrorCode {
	return (
		typeof value === 'string' && (DESMOS_SANDBOX_ERROR_CODES as readonly string[]).includes(value)
	);
}

export function parseDesmosSandboxMessage(data: unknown): DesmosSandboxMessage | null {
	if (!data || typeof data !== 'object') return null;
	const message = data as { type?: unknown; code?: unknown; message?: unknown };
	if (message.type === 'ready') return { type: 'ready' };
	if (message.type !== 'error') return null;
	const code = isDesmosSandboxErrorCode(message.code) ? message.code : 'init';
	const text =
		typeof message.message === 'string' && message.message.trim()
			? message.message
			: desmosUserMessage(code);
	return { type: 'error', code, message: text };
}
