import { describe, expect, it } from 'vitest';
import { canAdoptNeonBaseline } from '../../scripts/neon-baseline';
import history from '../../scripts/neon-baseline-history.json';

const applied = () => Object.entries(history).map(([id, checksum]) => ({ id, checksum }));

describe('Neon baseline adoption', () => {
	it('runs the generated migration on an empty database', () => {
		expect(canAdoptNeonBaseline([])).toBe(false);
	});

	it('adopts a fully applied history without replaying DDL', () => {
		expect(canAdoptNeonBaseline(applied())).toBe(true);
	});

	it('accepts the previously supported FRQ migration alias', () => {
		const rows = applied().map((row) => ({
			...row,
			id: row.id === '0027_windy_william_stryker' ? '0026_windy_william_stryker' : row.id
		}));
		expect(canAdoptNeonBaseline(rows)).toBe(true);
	});

	it('rejects an incomplete migration history', () => {
		expect(() => canAdoptNeonBaseline(applied().slice(0, -1))).toThrow('0029_pretty_landau');
	});

	it('rejects a modified historical migration', () => {
		const rows = applied();
		rows[0].checksum = 'changed';
		expect(() => canAdoptNeonBaseline(rows)).toThrow('different checksum');
	});

	it('rejects an unrelated migration ledger instead of replaying the baseline', () => {
		expect(() => canAdoptNeonBaseline([{ id: 'unrelated', checksum: 'unknown' }])).toThrow(
			'Cannot adopt baseline'
		);
	});
});
