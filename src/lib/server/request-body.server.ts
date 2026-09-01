export class RequestBodyTooLargeError extends Error {
	constructor() {
		super('Request body is too large');
		this.name = 'RequestBodyTooLargeError';
	}
}

/** Read and parse a JSON request without allowing an unbounded body into memory. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
		throw new RequestBodyTooLargeError();
	}
	if (!request.body) return null;

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let receivedBytes = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		receivedBytes += value.byteLength;
		if (receivedBytes > maxBytes) {
			await reader.cancel();
			throw new RequestBodyTooLargeError();
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(receivedBytes);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	if (receivedBytes === 0) return null;
	return JSON.parse(new TextDecoder().decode(bytes));
}
