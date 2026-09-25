import history from './neon-baseline-history.json';

export const NEON_BASELINE_ID = '0000_baseline';

/** Adopt the generated baseline only after the entire previous history was applied. */
export function canAdoptNeonBaseline(applied: Array<{ id: string; checksum: string }>): boolean {
	if (applied.length === 0) return false;

	const checksums = new Map(applied.map((row) => [row.id, row.checksum]));
	for (const [id, expected] of Object.entries(history)) {
		const actual =
			checksums.get(id) ??
			(id === '0027_windy_william_stryker'
				? checksums.get('0026_windy_william_stryker')
				: undefined);
		if (actual !== expected) {
			throw new Error(
				`Cannot adopt baseline: ${id} is missing or has a different checksum. ` +
					'Apply the original migrations from release 1.9.4 before retrying; do not replay the baseline on an existing database.'
			);
		}
	}
	return true;
}
