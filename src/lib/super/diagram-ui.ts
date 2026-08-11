export type DiagramOutput = {
	kind: 'diagram';
	type: string;
	title?: string;
	accessibleDescription: string;
	svg: string;
	width: number;
	height: number;
	viewBox: string;
};

export function getDiagramOutput(value: unknown): DiagramOutput | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const output = value as Record<string, unknown>;
	if (
		output.kind !== 'diagram' ||
		typeof output.type !== 'string' ||
		typeof output.accessibleDescription !== 'string' ||
		typeof output.svg !== 'string' ||
		typeof output.width !== 'number' ||
		typeof output.height !== 'number'
	) {
		return null;
	}
	return output as unknown as DiagramOutput;
}

export function diagramDataUrl(svg: string): string {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
