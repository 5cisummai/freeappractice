import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateText: vi.fn() }));
vi.mock('ai', async (importOriginal) => ({
	...(await importOriginal<typeof import('ai')>()),
	generateText: mocks.generateText
}));
vi.mock('#lib/server/gateway-credentials.server.js', () => ({
	gatewayModel: () => 'simulation-model'
}));

import { generateCoachSimulation } from '#lib/agent/tools/simulation.server.js';

beforeEach(() => vi.clearAllMocks());

describe('dedicated simulation generation', () => {
	it.each(['open_physics_sim', 'open_math_explorer'] as const)(
		'%s generates sandboxed HTML, forwards cancellation, and records usage',
		async (name) => {
			const recordGenerationUsage = vi.fn();
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
			const output = await generateCoachSimulation(name, brief, {
				abortSignal,
				recordGenerationUsage
			});
			expect(mocks.generateText).toHaveBeenCalledWith(
				expect.objectContaining({
					abortSignal,
					prompt: JSON.stringify(brief),
					instructions: expect.stringContaining('Return only one complete HTML document')
				})
			);
			expect(recordGenerationUsage).toHaveBeenCalledWith(usage);
			expect(output).toMatchObject({ kind: 'canvas_html', title: brief.title });
			if (!output || !('html' in output)) throw new Error('Expected HTML artifact');
			expect(output.html).toContain('data-pip-canvas-csp');
			expect(output.html).toContain('data-pip-canvas-resize');
		}
	);

	it('rejects truncated HTML while recording its usage', async () => {
		const recordGenerationUsage = vi.fn();
		mocks.generateText.mockResolvedValue({
			text: '<!DOCTYPE html><html>',
			finishReason: 'length',
			totalUsage: {}
		});
		const output = await generateCoachSimulation(
			'open_physics_sim',
			{ title: 'Motion', description: 'Explore motion.' },
			{ recordGenerationUsage }
		);
		expect(output).toHaveProperty('error');
		expect(recordGenerationUsage).toHaveBeenCalledOnce();
	});
});
