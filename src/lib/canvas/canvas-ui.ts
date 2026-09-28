import type { CanvasHtmlArtifact } from '$lib/canvas/types';

export function getCanvasHtmlOutput(value: unknown): CanvasHtmlArtifact | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const output = value as Record<string, unknown>;
	if (
		output.kind !== 'canvas_html' ||
		(output.tool !== 'physics_sim' && output.tool !== 'math_explorer') ||
		typeof output.title !== 'string' ||
		typeof output.accessibleDescription !== 'string' ||
		typeof output.html !== 'string'
	) {
		return null;
	}
	return output as unknown as CanvasHtmlArtifact;
}
