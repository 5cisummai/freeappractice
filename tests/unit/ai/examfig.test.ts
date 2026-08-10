import { describe, expect, it } from 'vitest';
import { validateExamfigDiagram } from '$lib/ai/examfig.server';

describe('examfig diagram validation', () => {
	it('renders a valid semantic spec through the SSR runtime', () => {
		const result = validateExamfigDiagram({
			type: 'table',
			accessibleDescription: 'A one-row data table.',
			headers: ['Group', 'Value'],
			rows: [['A', '1']]
		});

		expect(result).toMatchObject({ valid: true });
	});

	it('fails closed for missing accessibility metadata and unknown types', () => {
		expect(validateExamfigDiagram({ type: 'table' })).toMatchObject({ valid: false });
		expect(
			validateExamfigDiagram({ type: 'not-an-examfig-type', accessibleDescription: 'A diagram.' })
		).toMatchObject({ valid: false });
	});
});
