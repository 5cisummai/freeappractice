import { describe, expect, it } from 'vitest';
import { renderDiagram, validateDiagram } from '$lib/super/diagram-renderer.server';

describe('Super Agent diagram rendering', () => {
	it('validates and renders a semantic examfig free-body diagram', () => {
		const spec = {
			type: 'free-body',
			title: 'Forces on a lowered package',
			accessibleDescription: 'A package with upward tension and downward gravitational force.',
			object: { shape: 'block', label: 'm' },
			forces: [
				{ direction: 'up', label: 'T', kind: 'tension' },
				{ direction: 'down', label: 'mg', kind: 'gravity' }
			]
		};

		const validation = validateDiagram(spec);
		expect(validation.success).toBe(true);
		const result = renderDiagram(spec);
		expect(result.kind).toBe('diagram');
		expect(result.svg).toContain('<svg');
		expect(result.svg).toContain(
			'<desc>A package with upward tension and downward gravitational force.</desc>'
		);
		expect(result.svg).not.toContain('<script');
	});

	it('rejects incomplete semantic input before rendering', () => {
		const validation = validateDiagram({ type: 'free-body', accessibleDescription: 'Forces' });
		expect(validation.success).toBe(false);
		if (!validation.success) expect(validation.errors.join(' ')).toContain('object');
	});
});
