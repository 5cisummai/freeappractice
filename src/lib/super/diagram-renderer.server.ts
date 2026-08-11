import {
	createRenderContext,
	getRenderer,
	LIMITS,
	registerRenderer,
	serializeSvg,
	validateSvg,
	type DiagramRenderer,
	type DiagramSpec
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

const chartRenderers = [
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

for (const renderer of chartRenderers) {
	registerRenderer(renderer as unknown as DiagramRenderer<{ type: string }>);
}
registerScienceRenderers();

export type DiagramSpecInput = {
	type: string;
	accessibleDescription: string;
	title?: string;
	width?: number;
	height?: number;
	theme?: 'monochrome';
	[key: string]: unknown;
};

export type SuperDiagram = {
	kind: 'diagram';
	type: string;
	title?: string;
	accessibleDescription: string;
	svg: string;
	width: number;
	height: number;
	viewBox: string;
};

type ValidationResult =
	{ success: true; spec: DiagramSpecInput } | { success: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/** Validate the semantic input before asking an examfig renderer to lay it out. */
export function validateDiagram(value: unknown): ValidationResult {
	if (!isRecord(value)) return { success: false, errors: ['Diagram spec must be an object.'] };

	const errors: string[] = [];
	const type = value.type;
	const description = value.accessibleDescription;
	if (typeof type !== 'string' || !type.trim()) errors.push('Diagram type is required.');
	if (typeof description !== 'string' || !description.trim()) {
		errors.push('accessibleDescription is required.');
	} else if (description.length > LIMITS.maxAccessibleDescriptionLength) {
		errors.push('accessibleDescription is too long.');
	}
	if (typeof value.title === 'string' && value.title.length > LIMITS.maxTitleLength) {
		errors.push('title is too long.');
	}
	for (const field of ['width', 'height']) {
		const dimension = value[field];
		if (
			dimension !== undefined &&
			(!isFiniteNumber(dimension) || dimension < 1 || dimension > 4_000)
		) {
			errors.push(`${field} must be a finite number between 1 and 4000.`);
		}
	}
	if (type === 'free-body') {
		if (!isRecord(value.object)) errors.push('free-body diagrams require an object.');
		if (!Array.isArray(value.forces) || value.forces.length === 0) {
			errors.push('free-body diagrams require at least one force.');
		}
	}
	if (type === 'inclined-plane' && !isFiniteNumber(value.angle)) {
		errors.push('inclined-plane diagrams require a numeric angle.');
	}

	if (errors.length) return { success: false, errors };
	return { success: true, spec: value as DiagramSpecInput };
}

/** Validate, render, and SVG-sanitize an examfig semantic diagram. */
export function renderDiagram(value: unknown): SuperDiagram {
	const validation = validateDiagram(value);
	if (!validation.success) throw new Error(validation.errors.join(' '));

	const spec = validation.spec;
	const renderer = getRenderer(spec.type);
	const context = createRenderContext(spec.theme ?? 'monochrome');
	const plan = renderer.render(spec as unknown as DiagramSpec, context);
	const svg = serializeSvg(plan, context.theme, {
		title: spec.title,
		description: spec.accessibleDescription,
		includeTitle: Boolean(spec.title)
	});
	const safeSvg = validateSvg(svg);
	return {
		kind: 'diagram',
		type: spec.type,
		...(spec.title ? { title: spec.title } : {}),
		accessibleDescription: spec.accessibleDescription,
		svg: safeSvg.svg,
		width: safeSvg.width,
		height: safeSvg.height,
		viewBox: safeSvg.viewBox
	};
}
