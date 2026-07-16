import { createHash } from 'node:crypto';
import {
	MULTI_ATTEMPT_EXPERIMENT_KEY,
	MULTI_ATTEMPT_EXPERIMENT_VERSION,
	type PracticeVariant
} from '$lib/practice/multi-attempt';

/** Stable 50/50 assignment from user id + experiment identity (not client-chosen). */
export function assignPracticeVariant(
	userId: string,
	key = MULTI_ATTEMPT_EXPERIMENT_KEY,
	version = MULTI_ATTEMPT_EXPERIMENT_VERSION
): PracticeVariant {
	const digest = createHash('sha256').update(`${key}:v${version}:${userId}`).digest();
	return digest[0]! % 2 === 0 ? 'control' : 'multi_attempt_hints';
}
