import type { ToolSet } from 'ai';
import { z } from 'zod';
import { validateExamfigDiagram } from '$lib/ai/examfig.server';

const examfigDiagramInput = z.object({
	spec: z
		.record(z.string(), z.unknown())
		.describe('A semantic examfig DiagramSpec JSON object, not SVG')
});

/** Tools exposed to the question-generation agent for diagram authoring. */
export const examfigTools = {
	validateExamfigDiagram: {
		description:
			'Validate and SSR-render a semantic examfig DiagramSpec. Call this before returning any non-null diagram.',
		inputSchema: examfigDiagramInput,
		execute: async ({ spec }: z.infer<typeof examfigDiagramInput>) => validateExamfigDiagram(spec)
	}
} satisfies ToolSet;
