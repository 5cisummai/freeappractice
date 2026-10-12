import { renderExamfigDiagram } from '$lib/diagrams/examfig';

export type { ExamfigDiagramSpec } from '$lib/diagrams/examfig';

export type ExamfigValidationResult =
	{ valid: true; warnings: string[]; renderedBytes: number } | { valid: false; errors: string[] };

/** Validate a semantic DiagramSpec by rendering it through the SSR-safe examfig runtime. */
export function validateExamfigDiagram(input: unknown): ExamfigValidationResult {
	const result = renderExamfigDiagram(input);
	if (!result.valid) return result;
	return {
		valid: true,
		warnings: result.warnings,
		renderedBytes: result.renderedBytes
	};
}
