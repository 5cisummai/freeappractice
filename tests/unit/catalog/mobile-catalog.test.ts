import { describe, expect, it } from 'vitest';
import { getMobileCatalogSnapshot } from '#lib/catalog/mobile-catalog.js';

describe('mobile catalog snapshot', () => {
	it('exposes ordered courses with MCQ availability and stable versioning', () => {
		const snapshot = getMobileCatalogSnapshot();
		expect(snapshot.datasetId).toBe('freeappractice.ap-classes');
		expect(snapshot.version).toMatch(/^[a-f0-9]{32}$/);
		expect(snapshot.courses.length).toBeGreaterThan(0);

		const biology = snapshot.courses.find((course) => course.name === 'AP Biology');
		expect(biology).toMatchObject({
			id: 'ap-biology',
			displayName: 'AP Biology',
			mcqEnabled: true
		});
		expect(biology?.units[0]).toMatchObject({
			id: 'ap-biology-unit-1',
			number: 1,
			label: 'Unit 1: Chemistry of Life',
			mcqEnabled: true
		});

		const artHistory = snapshot.courses.find((course) => course.name === 'AP Art History');
		expect(artHistory?.mcqEnabled).toBe(false);

		expect(getMobileCatalogSnapshot().version).toBe(snapshot.version);
	});
});
