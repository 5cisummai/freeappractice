import { describe, expect, it } from 'vitest';
import {
	planUsesCollectionScan,
	planUsesIndexScan,
	poolSelectionFilter
} from '$lib/questions/pool-index-explain';

describe('pool-index-explain', () => {
	it('detects COLLSCAN in nested explain trees', () => {
		expect(
			planUsesCollectionScan({
				queryPlanner: {
					winningPlan: {
						stage: 'LIMIT',
						inputStage: { stage: 'COLLSCAN' }
					}
				}
			})
		).toBe(true);
	});

	it('accepts FETCH over IXSCAN as indexed', () => {
		const plan = {
			winningPlan: {
				stage: 'LIMIT',
				inputStage: {
					stage: 'FETCH',
					inputStage: { stage: 'IXSCAN' }
				}
			}
		};
		expect(planUsesCollectionScan(plan)).toBe(false);
		expect(planUsesIndexScan(plan)).toBe(true);
	});

	it('builds the production selection filter shape', () => {
		expect(poolSelectionFilter({ apClass: 'AP Biology', unit: 'Chemistry of Life', pivot: 0.5 })).toEqual({
			apClass: 'AP Biology',
			unit: 'Chemistry of Life',
			active: { $ne: false },
			randomKey: { $gte: 0.5 }
		});
	});
});
