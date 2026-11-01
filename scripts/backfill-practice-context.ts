/**
 * Personal-only, resumable backfill for the classroom rollout.
 *
 * Existing user-keyed records remain personal (organization_id = NULL).
 * The only rows created are durable sessions for legacy in-progress exams.
 * Dry-run is the default.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { getNeonDatabase } from '../src/lib/server/neon/db';
import { examAttempts, practiceSessions } from '../src/lib/server/neon/schema';

const args = new Set(process.argv.slice(2));
const batchSize = Math.min(Math.max(Number(process.env.PRACTICE_CONTEXT_BATCH_SIZE ?? 50), 1), 500);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');
const target = new URL(databaseUrl);
if (target.hostname.includes('-pooler'))
	throw new Error('Use a direct Neon host for the backfill.');
if (args.has('--apply') && process.env.PRACTICE_CONTEXT_CONFIRMED_HOST !== target.hostname) {
	throw new Error('Set PRACTICE_CONTEXT_CONFIRMED_HOST to the exact target host before applying.');
}

const db = getNeonDatabase();
const candidates = await db
	.select()
	.from(examAttempts)
	.where(and(isNull(examAttempts.practiceSessionId), eq(examAttempts.status, 'in_progress')))
	.orderBy(asc(examAttempts.startedAt))
	.limit(batchSize);

console.log(
	`${args.has('--apply') ? 'APPLY' : 'DRY RUN'} personal context backfill on ${target.hostname}; candidates=${candidates.length}; batchSize=${batchSize}`
);
if (!args.has('--apply')) process.exit(0);

for (const attempt of candidates) {
	const questionRefs = attempt.sections.flatMap((section) =>
		section.items.map((item) => ({
			questionId: item.questionId,
			questionType: section.kind === 'mcq' ? ('mcq' as const) : ('frq' as const)
		}))
	);
	const sessionId = randomUUID();
	await db.batch([
		db.insert(practiceSessions).values({
			id: sessionId,
			userId: attempt.userId,
			organizationId: null,
			mode: 'exam',
			course: attempt.course,
			status: attempt.status === 'in_progress' ? 'open' : 'completed',
			startedAt: attempt.startedAt,
			completedAt: attempt.submittedAt,
			questionRefs
		}),
		db
			.update(examAttempts)
			.set({ practiceSessionId: sessionId, updatedAt: new Date() })
			.where(and(eq(examAttempts.id, attempt.id), isNull(examAttempts.practiceSessionId)))
	]);
}
console.log(`Backfilled ${candidates.length} legacy exam sessions. Re-run until candidates=0.`);
