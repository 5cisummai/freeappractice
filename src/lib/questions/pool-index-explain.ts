/**
 * Pure helpers for verifying Mongo selection plans use the compound
 * { apClass, unit, active, randomKey } index (no COLLSCAN).
 */

export type ExplainPlanNode = {
	stage?: string;
	inputStage?: ExplainPlanNode;
	shards?: Array<{ winningPlan?: ExplainPlanNode }>;
	queryPlanner?: { winningPlan?: ExplainPlanNode };
	winningPlan?: ExplainPlanNode;
};

/** True if any stage in the explain tree is a collection scan. */
export function planUsesCollectionScan(node: ExplainPlanNode | null | undefined): boolean {
	if (!node) return false;
	if (node.stage === 'COLLSCAN') return true;
	if (planUsesCollectionScan(node.inputStage)) return true;
	if (node.winningPlan && planUsesCollectionScan(node.winningPlan)) return true;
	if (node.queryPlanner?.winningPlan && planUsesCollectionScan(node.queryPlanner.winningPlan)) {
		return true;
	}
	if (node.shards?.some((shard) => planUsesCollectionScan(shard.winningPlan))) return true;
	return false;
}

/** Prefer IXSCAN (or FETCH→IXSCAN) on the selection compound index. */
export function planUsesIndexScan(node: ExplainPlanNode | null | undefined): boolean {
	if (!node) return false;
	if (node.stage === 'IXSCAN') return true;
	if (planUsesIndexScan(node.inputStage)) return true;
	if (node.winningPlan && planUsesIndexScan(node.winningPlan)) return true;
	if (node.queryPlanner?.winningPlan && planUsesIndexScan(node.queryPlanner.winningPlan)) {
		return true;
	}
	if (node.shards?.some((shard) => planUsesIndexScan(shard.winningPlan))) return true;
	return false;
}

export const POOL_SELECTION_INDEX_NAME = 'apClass_1_unit_1_active_1_randomKey_1';

export const POOL_SELECTION_INDEX_KEY = {
	apClass: 1,
	unit: 1,
	active: 1,
	randomKey: 1
} as const;

/** Representative filter matching `selectRandomActiveDoc` (gte branch). */
export function poolSelectionFilter(opts: {
	apClass: string;
	unit: string;
	pivot: number;
}): Record<string, unknown> {
	return {
		apClass: opts.apClass,
		unit: opts.unit,
		active: { $ne: false },
		randomKey: { $gte: opts.pivot }
	};
}
