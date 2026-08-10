import {
	createRenderContext,
	getRenderer,
	monochromeTheme,
	rendererRegistry,
	registerRenderer,
	serializeSvg,
	validateSvg,
	type DiagramRenderer
} from '@examfig/core';
import {
	complexPlaneRenderer,
	crossSectionVolumeRenderer,
	dataPlotRenderer,
	functionGraphRenderer,
	matrixTransformationRenderer,
	parametricGraphRenderer,
	polarGraphRenderer,
	slopeFieldRenderer,
	supplyDemandRenderer,
	tableRenderer,
	unitCircleRenderer
} from '@examfig/charts';
import { registerScienceRenderers } from '@examfig/science';

export type ExamfigDiagramSpec = Record<string, unknown>;

type ExamfigRenderSuccess = {
	valid: true;
	svg: string;
	warnings: string[];
	renderedBytes: number;
};

type ExamfigRenderFailure = {
	valid: false;
	errors: string[];
};

export type ExamfigRenderResult = ExamfigRenderSuccess | ExamfigRenderFailure;

let renderersRegistered = false;

function ensureRenderersRegistered(): void {
	if (renderersRegistered) return;
	const chartRenderers: DiagramRenderer[] = [
		dataPlotRenderer,
		functionGraphRenderer,
		polarGraphRenderer,
		parametricGraphRenderer,
		slopeFieldRenderer,
		matrixTransformationRenderer,
		complexPlaneRenderer,
		unitCircleRenderer,
		crossSectionVolumeRenderer,
		supplyDemandRenderer,
		tableRenderer
	];
	for (const renderer of chartRenderers) registerRenderer(renderer);
	registerScienceRenderers();
	renderersRegistered = true;
}

/** Validate a semantic DiagramSpec, then render it with the installed examfig packages. */
export function renderExamfigDiagram(input: unknown): ExamfigRenderResult {
	ensureRenderersRegistered();
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return { valid: false, errors: ['Diagram must be a JSON object.'] };
	}

	const spec = input as ExamfigDiagramSpec;
	const type = spec.type;
	if (typeof type !== 'string' || !type.trim()) {
		return { valid: false, errors: ['Diagram must include a supported string `type`.'] };
	}
	if (typeof spec.accessibleDescription !== 'string' || !spec.accessibleDescription.trim()) {
		return {
			valid: false,
			errors: ['Every diagram requires a non-empty `accessibleDescription`.']
		};
	}
	if (!rendererRegistry.has(type)) {
		return { valid: false, errors: [`No examfig renderer is registered for type "${type}".`] };
	}

	try {
		const context = createRenderContext('monochrome', {
			theme: 'monochrome',
			includeTitle: typeof spec.title === 'string' && spec.title.length > 0
		});
		const plan = getRenderer(type).render(spec as { type: string }, context);
		const svg = serializeSvg(plan, monochromeTheme, {
			title: typeof spec.title === 'string' ? spec.title : undefined,
			description: spec.accessibleDescription,
			includeTitle: typeof spec.title === 'string' && spec.title.length > 0
		});
		const validated = validateSvg(svg);
		return {
			valid: true,
			svg: validated.svg,
			warnings: plan.warnings.map((warning) => warning.message),
			renderedBytes: validated.byteLength
		};
	} catch (error) {
		return {
			valid: false,
			errors: [error instanceof Error ? error.message : 'examfig could not render this diagram.']
		};
	}
}
