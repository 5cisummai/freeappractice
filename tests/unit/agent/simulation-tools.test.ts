import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateText: vi.fn() }));
vi.mock('ai', async (importOriginal) => ({
	...(await importOriginal<typeof import('ai')>()),
	generateText: mocks.generateText
}));
vi.mock('#lib/server/gateway-credentials.server.js', () => ({
	gatewayModel: () => 'simulation-model'
}));

import { createAgentTools } from '#lib/agent/tools/index.server.js';
import type { AgentToolsInput } from '#lib/agent/request.js';

beforeEach(() => vi.clearAllMocks());

describe('dedicated simulation generation', () => {
	it.each(['open_physics_sim', 'open_math_explorer'] as const)(
		'%s generates sandboxed HTML, forwards cancellation, and records usage',
		async (name) => {
			const recordGenerationUsage = vi.fn();
			const tools = createAgentTools({ recordGenerationUsage } as unknown as AgentToolsInput);
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
				abortSignal,
				context: {}
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
		const tools = createAgentTools({ recordGenerationUsage } as unknown as AgentToolsInput);
		mocks.generateText.mockResolvedValue({
			text: '<!DOCTYPE html><html>',
			finishReason: 'length',
			totalUsage: {}
		});
		const output = await tools.open_physics_sim.execute!(
			{ title: 'Motion', description: 'Explore motion.' },
			{ toolCallId: 'sim', messages: [], context: {} }
		);
		expect(output).toHaveProperty('error');
		expect(recordGenerationUsage).toHaveBeenCalledOnce();
	});
});
