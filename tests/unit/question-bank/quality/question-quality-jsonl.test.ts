import { describe, expect, it } from 'vitest';
import { forEachJsonlLine, JsonlChunkBuilder } from '$lib/question-bank/quality/jsonl';

describe('question quality JSONL processing', () => {
	it('keeps input in bounded parts without joining a giant string', () => {
		const builder = new JsonlChunkBuilder(1024);
		builder.add(JSON.stringify({ id: 1 }));
		builder.add(JSON.stringify({ id: 2 }));
		const parts = builder.toParts();
		expect(parts.join('')).toBe('{"id":1}\n{"id":2}');
		expect(parts.every((part) => Buffer.byteLength(part) <= 1024)).toBe(true);
	});

	it('processes streamed lines across chunk boundaries', async () => {
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('{"id":1}\n{"id"'));
				controller.enqueue(new TextEncoder().encode(':2}\r\n'));
				controller.close();
			}
		});
		const lines: string[] = [];
		await forEachJsonlLine(stream, async (line) => {
			lines.push(line);
		});
		expect(lines).toEqual(['{"id":1}', '{"id":2}']);
	});
});
