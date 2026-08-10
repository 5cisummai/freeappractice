import type { ToolSet } from 'ai';
import { z } from 'zod';
import { validateExamfigDiagram } from '$lib/ai/examfig.server';

const examfigDiagramInput = z.object({
	spec: z.string().describe('A JSON-encoded semantic examfig DiagramSpec object, not SVG')
});

/** Tools exposed to the question-generation agent for diagram authoring. */
export const examfigTools = {
	validateExamfigDiagram: {
		description:
			'Validate and SSR-render a semantic examfig DiagramSpec. Call this before returning any non-null diagram.',
		inputSchema: examfigDiagramInput,
		execute: async ({ spec }: z.infer<typeof examfigDiagramInput>) => {
			try {
				return validateExamfigDiagram(JSON.parse(spec));
			} catch (error) {
				return {
					valid: false as const,
					errors: [error instanceof Error ? error.message : 'Diagram spec was not valid JSON.']
				};
			}
		}
	}
} satisfies ToolSet;
