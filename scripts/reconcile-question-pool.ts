/**
 * scripts/reconcile-question-pool.ts
 *
 * Full-catalog reconcile: refresh target/observedCount on every bucket, enqueue
 * low-water deficits, and idle stale pending jobs that are already at target.
 * Expensive (N+1) — ops only, not cron.
 *
 *   bun run pool:reconcile
 */

import 'dotenv/config';
import { reconcilePoolRefillJobs } from '../src/lib/questions/pool-refill-queue.server';
import { QUESTION_POOL_CONFIG } from '../src/lib/questions/pool-constants';
import { connectDb } from '../src/lib/server/db';

async function main() {
	await connectDb();
	const result = await reconcilePoolRefillJobs(QUESTION_POOL_CONFIG);
	console.log(
		`Reconciled ${result.reconciled} bucket(s); enqueued ${result.enqueued} deficit job(s).`
	);
	process.exit(0);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
