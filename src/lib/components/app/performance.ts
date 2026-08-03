/** Semantic color for scores — communicates status, not decoration. */
export type PerformanceTone = 'strong' | 'ok' | 'weak';

export function performanceTone(score: number): PerformanceTone {
	if (score >= 75) return 'strong';
	if (score >= 50) return 'ok';
	return 'weak';
}

export function performanceTextClass(score: number): string {
	switch (performanceTone(score)) {
		case 'strong':
			return 'text-emerald-600 dark:text-emerald-400';
		case 'ok':
			return 'text-amber-600 dark:text-amber-400';
		case 'weak':
			return 'text-rose-600 dark:text-rose-400';
	}
}

export function performanceBarClass(score: number): string {
	switch (performanceTone(score)) {
		case 'strong':
			return 'bg-emerald-500';
		case 'ok':
			return 'bg-amber-500';
		case 'weak':
			return 'bg-rose-500';
	}
}
