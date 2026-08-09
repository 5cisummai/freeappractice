const DEFAULT_CHUNK_BYTES = 1024 * 1024;

/** Builds JSONL as bounded chunks so callers never create a second giant joined string. */
export class JsonlChunkBuilder {
	private chunks: string[] = [];
	private current = '';
	private readonly chunkBytes: number;

	constructor(chunkBytes = DEFAULT_CHUNK_BYTES) {
		if (!Number.isInteger(chunkBytes) || chunkBytes < 1024) {
			throw new Error('JSONL chunk size must be at least 1024 bytes');
		}
		this.chunkBytes = chunkBytes;
	}

	add(line: string): void {
		const next = this.current ? `${this.current}\n${line}` : line;
		if (this.current && Buffer.byteLength(next) > this.chunkBytes) {
			this.chunks.push(`${this.current}\n`);
			this.current = line;
			return;
		}
		this.current = next;
	}

	get sizeBytes(): number {
		return (
			this.chunks.reduce((total, chunk) => total + Buffer.byteLength(chunk), 0) +
			Buffer.byteLength(this.current)
		);
	}

	toParts(): string[] {
		return this.current ? [...this.chunks, this.current] : [...this.chunks];
	}
}

export async function forEachJsonlLine(
	stream: ReadableStream<Uint8Array>,
	onLine: (line: string) => Promise<void>
): Promise<void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let pending = '';
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			pending += decoder.decode(value, { stream: true });
			let newline = pending.indexOf('\n');
			while (newline >= 0) {
				const line = pending.slice(0, newline).replace(/\r$/, '');
				if (line) await onLine(line);
				pending = pending.slice(newline + 1);
				newline = pending.indexOf('\n');
			}
		}
		pending += decoder.decode();
		if (pending.trim()) await onLine(pending.replace(/\r$/, ''));
	} finally {
		reader.releaseLock();
	}
}
