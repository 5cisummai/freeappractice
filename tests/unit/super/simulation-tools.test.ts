import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateText: vi.fn() }));
vi.mock('ai', async (importOriginal) => ({
	...(await importOriginal<typeof import('ai')>()),
	generateText: mocks.generateText
}));
vi.mock('$lib/ai/service.server', () => ({ openaiModel: () => 'simulation-model' }));

import { createSuperTools } from '$lib/super/coach-tools.server';
import type { SuperToolsInput } from '$lib/super/agent-request';

beforeEach(() => vi.clearAllMocks());

describe('dedicated simulation generation', () => {
	it.each(['open_physics_sim', 'open_math_explorer'] as const)(
		'%s generates sandboxed HTML, forwards cancellation, and records usage',
		async (name) => {
			const recordGenerationUsage = vi.fn();
			const tools = createSuperTools({ recordGenerationUsage } as unknown as SuperToolsInput);
			const usage = { inputTokens: 100, outputTokens: 200 };
			mocks.generateText.mockResolvedValue({
				text: '<!DOCTYPE html><html><head></head><body>Interactive visual</body></html>',
				finishReason: 'stop',
				totalUsage: usage
			});
			const abortSignal = new AbortController().signal;
			const brief = {
				title: 'Explore motion',
				description: 'Show a labeled graph with a speed slider.'
			};
			const output = await tools[name].execute!(brief, {
				toolCallId: 'sim',
				messages: [],
				abortSignal
			});
			expect(mocks.generateText).toHaveBeenCalledWith(
				expect.objectContaining({
					abortSignal,
					prompt: JSON.stringify(brief),
					system: expect.stringContaining('Return only one complete HTML document')
				})
			);
			expect(recordGenerationUsage).toHaveBeenCalledWith(usage);
			expect(output).toMatchObject({ kind: 'canvas_html', title: brief.title });
			if (!output || !('html' in output)) throw new Error('Expected HTML artifact');
			expect(output.html).toContain('data-pip-canvas-csp');
			expect(output.html).toContain('data-pip-canvas-resize');
			const modelOutput = await tools[name].toModelOutput!({
				toolCallId: 'sim',
				input: brief,
				output
			});
			expect(JSON.stringify(modelOutput)).not.toContain('<html>');
		}
	);

	it('rejects truncated HTML while recording its usage', async () => {
		const recordGenerationUsage = vi.fn();
		const tools = createSuperTools({ recordGenerationUsage } as unknown as SuperToolsInput);
		mocks.generateText.mockResolvedValue({
			text: '<!DOCTYPE html><html>',
			finishReason: 'length',
			totalUsage: {}
		});
		const output = await tools.open_physics_sim.execute!(
			{ title: 'Motion', description: 'Explore motion.' },
			{ toolCallId: 'sim', messages: [] }
		);
		expect(output).toHaveProperty('error');
		expect(recordGenerationUsage).toHaveBeenCalledOnce();
	});
});
