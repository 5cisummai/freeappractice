const FORWARDED_REQUEST_HEADERS = [
	'accept',
	'accept-language',
	'cache-control',
	'content-encoding',
	'content-type',
	'if-modified-since',
	'if-none-match',
	'range',
	'user-agent'
] as const;

export function createPostHogProxyRequestInit(
	request: Request,
	clientIp: string | null
): RequestInit & { duplex: 'half' } {
	const headers = new Headers();

	for (const name of FORWARDED_REQUEST_HEADERS) {
		const value = request.headers.get(name);
		if (value !== null) {
			headers.set(name, value);
		}
	}

	// Let fetch manage upstream framing and response decompression.
	headers.set('accept-encoding', '');
	if (clientIp) {
		headers.set('x-forwarded-for', clientIp);
	}

	return {
		method: request.method,
		headers,
		body: request.body,
		duplex: 'half'
	};
}
