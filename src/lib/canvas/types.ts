export type CanvasHtmlTool = 'physics_sim' | 'math_explorer';

export type CanvasHtmlArtifact = {
	kind: 'canvas_html';
	tool: CanvasHtmlTool;
	title: string;
	accessibleDescription: string;
	html: string;
};

export type CanvasToolName = 'open_physics_sim' | 'open_math_explorer';

export function canvasToolToKind(tool: CanvasToolName): CanvasHtmlTool {
	switch (tool) {
		case 'open_physics_sim':
			return 'physics_sim';
		case 'open_math_explorer':
			return 'math_explorer';
		default: {
			const _exhaustive: never = tool;
			return _exhaustive;
		}
	}
}
