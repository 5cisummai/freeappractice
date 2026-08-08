/**
 * Resumable MongoDB -> Neon data migration.
 *
 * Source access is read-only. The target is reached through the Neon HTTPS
 * client, never pg/postgres or a WebSocket session. Every source document is
 * identified by a deterministic source key and every write is an idempotent
 * PostgreSQL upsert. The migration intentionally fails on collections that
 * are not in the allow-list so a new Mongo collection cannot disappear
 * silently during cutover.
 *
 * This script is intentionally not executed by the application. Run it from
 * a controlled operator environment after the Drizzle schema migration has
 * been reviewed and applied to a Neon branch.
 */
import { createHash } from 'node:crypto';
import { MongoClient, type Db, type Document } from 'mongodb';
import { neon } from '@neondatabase/serverless';

type Phase = 'inventory' | 'load' | 'verify';
type RawDocument = Document & { _id?: unknown; createdAt?: Date; updatedAt?: Date };

const sourceUri = process.env.SOURCE_DATABASE_URI;
const neonUrl = process.env.DATABASE_URL;
const phase = (process.argv.find((arg) => arg.startsWith('--phase='))?.split('=')[1] ??
	'inventory') as Phase;
const runId =
	process.argv.find((arg) => arg.startsWith('--run-id='))?.split('=')[1] ??
	`mongo-neon-${Date.now()}`;
const dryRun = process.argv.includes('--dry-run');
const batchSize = Number(
	process.argv.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1] ?? 100
);
const upsertsPerBatch = Number(process.env.MIGRATION_UPSERTS_PER_BATCH ?? 50);

if (!['inventory', 'load', 'verify'].includes(phase)) {
	throw new Error(`Unsupported phase ${JSON.stringify(phase)}`);
}
if (!sourceUri) throw new Error('SOURCE_DATABASE_URI is required for the legacy-data migration');
if (!neonUrl) throw new Error('DATABASE_URL is required');
if (!/^postgres(?:ql)?:\/\//i.test(neonUrl))
	throw new Error('DATABASE_URL must be a Neon PostgreSQL connection string');
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
	throw new Error('--batch-size must be an integer between 1 and 500');
}
if (!Number.isInteger(upsertsPerBatch) || upsertsPerBatch < 1 || upsertsPerBatch > 100) {
	throw new Error('MIGRATION_UPSERTS_PER_BATCH must be an integer between 1 and 100');
}

const sql = neon(neonUrl);

type PendingUpsert = {
	table: string;
	columns: string[];
	values: unknown[];
	conflict: string;
	updates: string[];
};

let pendingUpserts: PendingUpsert[] = [];

function idOf(value: unknown): string {
	if (
		value &&
		typeof value === 'object' &&
		'toHexString' in value &&
		typeof value.toHexString === 'function'
	) {
		return value.toHexString();
	}
	return String(value ?? '');
}

function requiredId(document: RawDocument, collection: string): string {
	const id = idOf(document._id);
	if (!id) throw new Error(`${collection} document is missing _id`);
	return id;
}

function dateOf(value: unknown, fallback = new Date()): Date {
	if (value instanceof Date) return value;
	if (typeof value === 'string' || typeof value === 'number') {
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}
	return fallback;
}

function optionalDate(value: unknown): Date | null {
	return value == null ? null : dateOf(value);
}

function stringValue(value: unknown): string | null {
	return value == null ? null : removeNullBytes(String(value));
}

function boolValue(value: unknown, fallback = false): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function intValue(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function jsonValue(value: unknown): string {
	return JSON.stringify(value ?? null, (_, nested) => {
		if (nested instanceof Date) return nested.toISOString();
		if (nested && typeof nested === 'object' && 'toHexString' in nested) return idOf(nested);
		if (Buffer.isBuffer(nested)) return nested.toString('base64');
		return nested;
	});
}

function stableId(...parts: unknown[]): string {
	return createHash('sha256').update(parts.map(String).join('\u001f')).digest('hex').slice(0, 32);
}

function checksum(document: RawDocument): string {
	return createHash('sha256').update(jsonValue(document)).digest('hex');
}

function arrayValue(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function normalizeObject(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function removeNullBytes(value: string): string {
	return value.replaceAll('\u0000', '');
}

function cleanParameter(value: unknown): unknown {
	if (typeof value === 'string') return removeNullBytes(value);
	if (Array.isArray(value)) return value.map(cleanParameter);
	return value;
}

function nullBytePaths(value: unknown, path = '', paths: string[] = []): string[] {
	if (typeof value === 'string') {
		if (value.includes('\u0000')) paths.push(path || '<root>');
		return paths;
	}
	if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value))
		return paths;
	if ('toHexString' in value && typeof value.toHexString === 'function') return paths;
	if (Array.isArray(value)) {
		value.forEach((item, index) => nullBytePaths(item, `${path}[${index}]`, paths));
		return paths;
	}
	for (const [key, nested] of Object.entries(value))
		nullBytePaths(nested, path ? `${path}.${key}` : key, paths);
	return paths;
}

async function query(text: string, values: unknown[] = []): Promise<unknown[]> {
	if (dryRun) return [];
	return (await sql.query(text, values)) as unknown[];
}

async function flushWrites(): Promise<void> {
	if (dryRun || pendingUpserts.length === 0) return;
	const upserts = pendingUpserts;
	pendingUpserts = [];
	const groups = new Map<string, PendingUpsert[]>();
	for (const upsert of upserts) {
		const key = [upsert.table, ...upsert.columns, upsert.conflict, ...upsert.updates].join(
			'\u001f'
		);
		const group = groups.get(key) ?? [];
		group.push(upsert);
		groups.set(key, group);
	}

	const statements = [...groups.values()].map((group) => {
		const first = group[0];
		const values: unknown[] = [];
		const rows = group.map((item, rowIndex) => {
			const placeholders = item.values.map((value, columnIndex) => {
				values.push(value);
				return `$${rowIndex * item.values.length + columnIndex + 1}`;
			});
			return `(${placeholders.join(', ')})`;
		});
		const updateClause = first.updates.length
			? ` DO UPDATE SET ${first.updates.map((column) => `"${column}" = EXCLUDED."${column}"`).join(', ')}`
			: ' DO NOTHING';
		return {
			table: first.table,
			rowCount: group.length,
			parameterCount: values.length,
			statement: () =>
				sql.query(
					`INSERT INTO ${first.table} (${first.columns.map((column) => `"${column}"`).join(', ')}) VALUES ${rows.join(', ')} ON CONFLICT (${first.conflict})${updateClause}`,
					values
				)
		};
	});
	for (const item of statements) {
		await item.statement();
	}
}

async function targetHasRow(table: string, column: string, value: string): Promise<boolean> {
	if (dryRun) return true;
	const rows = await query(`SELECT 1 FROM ${table} WHERE "${column}" = $1 LIMIT 1`, [value]);
	return rows.length > 0;
}

async function recordNullByteTransform(collection: string, document: RawDocument): Promise<void> {
	const fields = nullBytePaths(document);
	if (!fields.length) return;
	const sourceId = requiredId(document, collection);
	await upsert(
		'ops.migration_transforms',
		['id', 'run_id', 'source_collection', 'source_id', 'field_paths', 'transformation'],
		[
			stableId(runId, collection, sourceId, 'remove-nul'),
			runId,
			collection,
			sourceId,
			fields,
			'Removed NUL bytes because PostgreSQL text cannot encode U+0000'
		],
		'"id"',
		['field_paths', 'transformation']
	);
}

async function upsert(
	table: string,
	columns: string[],
	values: unknown[],
	conflict: string,
	updates: string[]
): Promise<void> {
	if (dryRun) return;
	pendingUpserts.push({ table, columns, values: values.map(cleanParameter), conflict, updates });
}

async function recordLedger(
	collection: string,
	sourceId: string,
	targetTable: string,
	targetId: string,
	document: RawDocument
): Promise<void> {
	await upsert(
		'ops.migration_ledger',
		[
			'run_id',
			'source_collection',
			'source_id',
			'target_table',
			'target_id',
			'checksum',
			'migrated_at'
		],
		[runId, collection, sourceId, targetTable, targetId, checksum(document), new Date()],
		'"source_collection", "source_id", "target_table"',
		['run_id', 'target_id', 'checksum', 'migrated_at']
	);
}

async function reject(
	collection: string,
	sourceId: string | null,
	reason: string,
	document: RawDocument
): Promise<void> {
	await upsert(
		'ops.migration_rejects',
		['id', 'run_id', 'source_collection', 'source_id', 'reason', 'document'],
		[
			stableId(runId, collection, sourceId ?? ''),
			runId,
			collection,
			sourceId,
			reason,
			jsonValue(document)
		],
		'"id"',
		['reason', 'document']
	);
}

async function archiveLegacyDocument(
	collection: string,
	sourceId: string,
	document: RawDocument
): Promise<void> {
	await upsert(
		'ops.legacy_documents',
		['source_collection', 'source_id', 'run_id', 'document', 'archived_at'],
		[collection, sourceId, runId, jsonValue(document), new Date()],
		'"source_collection", "source_id"',
		['run_id', 'document', 'archived_at']
	);
	await recordLedger(
		collection,
		sourceId,
		'ops.legacy_documents',
		`${collection}:${sourceId}`,
		document
	);
}

function sourceCollections(db: Db): Promise<string[]> {
	return db
		.listCollections({}, { nameOnly: true })
		.toArray()
		.then((rows) => rows.map((row) => row.name).sort());
}

const knownCollections = new Set([
	'authUsers',
	'authSessions',
	'authAccounts',
	'authVerifications',
	'authSubscriptions',
	'rateLimit',
	'betterAuthMigrationMap',
	'users',
	'userprofiles',
	'question_ids',
	'questionrecenttopics',
	'frqrecenttopics',
	'conversations',
	'seenquestions',
	'blogposts',
	'cachemisslocks',
	'questions',
	'questions_pool_v2',
	'frqquestions',
	'frqquestions_pool_v2',
	'frqattempts',
	'poolrefillstates',
	'poolbucketwritelocks',
	'poolgenerationbudgets',
	'questiongenclasstotals',
	'questiongenunitdetails',
	'questiongenunitglobals',
	'referrals',
	'tutor_profiles',
	'super_billing_access',
	'super_grants',
	'super_usage_rollups',
	'insight_reports',
	'study_plans',
	'study_plan_audits',
	'coach_audits',
	'super_cleanup_jobs',
	'question_quality',
	'question_quality_feedback',
	'question_quality_review_jobs',
	'question_quality_review_job_items'
]);

const mcqPoolNames = new Set([
	'questions',
	'questions_pool_v2',
	process.env.QUESTION_POOL_MCQ_COLLECTION ?? 'questions'
]);
const frqPoolNames = new Set([
	'frqquestions',
	'frqquestions_pool_v2',
	process.env.QUESTION_POOL_FRQ_COLLECTION ?? 'frqquestions'
]);

async function createRun(): Promise<void> {
	await upsert(
		'ops.migration_runs',
		['id', 'phase', 'status', 'started_at', 'completed_at', 'options', 'error'],
		[
			runId,
			phase,
			'running',
			new Date(),
			null,
			jsonValue({ dryRun, batchSize, source: 'mongo' }),
			null
		],
		'"id"',
		['phase', 'status', 'started_at', 'completed_at', 'options', 'error']
	);
}

async function completeRun(status: 'completed' | 'failed', error?: unknown): Promise<void> {
	await query(
		'UPDATE ops.migration_runs SET status = $1, completed_at = $2, error = $3 WHERE id = $4',
		[status, new Date(), error ? String(error) : null, runId]
	);
}

async function inventory(db: Db): Promise<void> {
	const collections = await sourceCollections(db);
	const unexpected = collections.filter(
		(name) => !knownCollections.has(name) && !mcqPoolNames.has(name) && !frqPoolNames.has(name)
	);
	for (const name of collections) {
		const collection = db.collection(name);
		const sample = await collection.findOne({});
		const count = await collection.countDocuments();
		console.log(
			JSON.stringify({
				collection: name,
				count,
				sampleKeys: sample ? Object.keys(sample).sort() : []
			})
		);
	}
	if (unexpected.length) {
		throw new Error(`Unmapped Mongo collections: ${unexpected.join(', ')}`);
	}
}

async function eachDocument(
	db: Db,
	names: string[],
	handler: (collection: string, document: RawDocument) => Promise<void>
): Promise<void> {
	for (const collectionName of names) {
		const collection = db.collection<RawDocument>(collectionName);
		const cursor = collection.find({}).batchSize(batchSize);
		try {
			for await (const document of cursor) {
				await recordNullByteTransform(collectionName, document);
				await handler(collectionName, document);
				if (pendingUpserts.length >= upsertsPerBatch) await flushWrites();
			}
		} finally {
			await flushWrites();
		}
	}
}

async function migrateAuth(collectionName: string, document: RawDocument): Promise<void> {
	const id = requiredId(document, collectionName);
	const created = dateOf(document.createdAt);
	const updated = dateOf(document.updatedAt, created);
	if (collectionName === 'authUsers') {
		await upsert(
			'auth.users',
			[
				'id',
				'name',
				'email',
				'email_verified',
				'image',
				'stripe_customer_id',
				'created_at',
				'updated_at'
			],
			[
				id,
				document.name ?? '',
				document.email ?? '',
				boolValue(document.emailVerified),
				stringValue(document.image),
				stringValue(document.stripeCustomerId),
				created,
				updated
			],
			'"id"',
			['name', 'email', 'email_verified', 'image', 'stripe_customer_id', 'updated_at']
		);
		await recordLedger(collectionName, id, 'auth.users', id, document);
		return;
	}
	if (collectionName === 'authSessions') {
		await upsert(
			'auth.sessions',
			[
				'id',
				'expires_at',
				'token',
				'created_at',
				'updated_at',
				'ip_address',
				'user_agent',
				'user_id'
			],
			[
				id,
				dateOf(document.expiresAt),
				document.token ?? '',
				created,
				updated,
				stringValue(document.ipAddress),
				stringValue(document.userAgent),
				String(document.userId ?? '')
			],
			'"id"',
			['expires_at', 'token', 'updated_at', 'ip_address', 'user_agent', 'user_id']
		);
		await recordLedger(collectionName, id, 'auth.sessions', id, document);
		return;
	}
	if (collectionName === 'authAccounts') {
		await upsert(
			'auth.accounts',
			[
				'id',
				'account_id',
				'provider_id',
				'user_id',
				'access_token',
				'refresh_token',
				'id_token',
				'access_token_expires_at',
				'refresh_token_expires_at',
				'scope',
				'password',
				'created_at',
				'updated_at'
			],
			[
				id,
				document.accountId ?? '',
				document.providerId ?? '',
				String(document.userId ?? ''),
				stringValue(document.accessToken),
				stringValue(document.refreshToken),
				stringValue(document.idToken),
				optionalDate(document.accessTokenExpiresAt),
				optionalDate(document.refreshTokenExpiresAt),
				stringValue(document.scope),
				stringValue(document.password),
				created,
				updated
			],
			'"id"',
			[
				'account_id',
				'provider_id',
				'user_id',
				'access_token',
				'refresh_token',
				'id_token',
				'access_token_expires_at',
				'refresh_token_expires_at',
				'scope',
				'password',
				'updated_at'
			]
		);
		await recordLedger(collectionName, id, 'auth.accounts', id, document);
		return;
	}
	if (collectionName === 'authVerifications') {
		await upsert(
			'auth.verifications',
			['id', 'identifier', 'value', 'expires_at', 'created_at', 'updated_at'],
			[
				id,
				document.identifier ?? '',
				document.value ?? '',
				dateOf(document.expiresAt),
				created,
				updated
			],
			'"id"',
			['identifier', 'value', 'expires_at', 'updated_at']
		);
		await recordLedger(collectionName, id, 'auth.verifications', id, document);
		return;
	}
	if (collectionName === 'authSubscriptions') {
		await upsert(
			'auth.subscriptions',
			[
				'id',
				'plan',
				'reference_id',
				'stripe_customer_id',
				'stripe_subscription_id',
				'status',
				'period_start',
				'period_end',
				'trial_start',
				'trial_end',
				'cancel_at_period_end',
				'cancel_at',
				'canceled_at',
				'ended_at',
				'seats',
				'billing_interval',
				'stripe_schedule_id',
				'created_at',
				'updated_at'
			],
			[
				id,
				document.plan ?? 'super',
				document.referenceId ?? document.userId ?? '',
				stringValue(document.stripeCustomerId),
				stringValue(document.stripeSubscriptionId),
				document.status ?? 'incomplete',
				optionalDate(document.periodStart),
				optionalDate(document.periodEnd),
				optionalDate(document.trialStart),
				optionalDate(document.trialEnd),
				boolValue(document.cancelAtPeriodEnd),
				optionalDate(document.cancelAt),
				optionalDate(document.canceledAt),
				optionalDate(document.endedAt),
				document.seats == null ? null : intValue(document.seats),
				stringValue(document.billingInterval),
				stringValue(document.stripeScheduleId),
				created,
				updated
			],
			'"id"',
			[
				'plan',
				'reference_id',
				'stripe_customer_id',
				'stripe_subscription_id',
				'status',
				'period_start',
				'period_end',
				'trial_start',
				'trial_end',
				'cancel_at_period_end',
				'cancel_at',
				'canceled_at',
				'ended_at',
				'seats',
				'billing_interval',
				'stripe_schedule_id',
				'updated_at'
			]
		);
		await recordLedger(collectionName, id, 'auth.subscriptions', id, document);
		return;
	}
	if (collectionName === 'rateLimit') {
		await upsert(
			'auth.rate_limits',
			['id', 'key', 'count', 'last_request'],
			[id, document.key ?? id, intValue(document.count), intValue(document.lastRequest)],
			'"id"',
			['key', 'count', 'last_request']
		);
		await recordLedger(collectionName, id, 'auth.rate_limits', id, document);
	}
}

async function migrateProfile(collectionName: string, document: RawDocument): Promise<void> {
	const userId = String(document.userId ?? '');
	const sourceId = requiredId(document, collectionName);
	if (!userId) return archiveLegacyDocument(collectionName, sourceId, document);
	if (!(await targetHasRow('auth.users', 'id', userId)))
		return archiveLegacyDocument(collectionName, sourceId, document);
	const created = dateOf(document.createdAt);
	const updated = dateOf(document.updatedAt, created);
	await upsert(
		'app.user_profiles',
		['user_id', 'referral_code', 'subjects', 'created_at', 'updated_at'],
		[
			userId,
			stringValue(document.referralCode),
			arrayValue(document.subjects).map(String),
			created,
			updated
		],
		'"user_id"',
		['referral_code', 'subjects', 'updated_at']
	);
	for (const [position, subject] of arrayValue(document.subjects).entries()) {
		await upsert(
			'app.user_subjects',
			['user_id', 'subject', 'position', 'created_at'],
			[userId, String(subject), position, created],
			'"user_id", "subject"',
			['position']
		);
	}
	for (const [position, progress] of arrayValue(document.progress).entries()) {
		const row = normalizeObject(progress);
		await upsert(
			'app.user_progress',
			[
				'user_id',
				'ap_class',
				'unit',
				'completed',
				'mastery',
				'total_attempts',
				'correct_attempts',
				'last_attempt_at',
				'last_reviewed_at',
				'updated_at'
			],
			[
				userId,
				row.apClass ?? '',
				row.unit ?? '',
				boolValue(row.completed),
				numberValue(row.mastery),
				intValue(row.totalAttempts),
				intValue(row.correctAttempts),
				optionalDate(row.lastAttemptAt),
				optionalDate(row.lastReviewedAt),
				updated
			],
			'"user_id", "ap_class", "unit"',
			[
				'completed',
				'mastery',
				'total_attempts',
				'correct_attempts',
				'last_attempt_at',
				'last_reviewed_at',
				'updated_at'
			]
		);
		void position;
	}
	for (const [position, attempt] of arrayValue(document.questionHistory).entries()) {
		const row = normalizeObject(attempt);
		const attemptId = stableId(userId, 'mcq-history', position, row.questionId, row.attemptedAt);
		await upsert(
			'app.mcq_attempts',
			[
				'id',
				'user_id',
				'question_id',
				'ap_class',
				'unit',
				'selected_answer',
				'was_correct',
				'time_taken_ms',
				'attempted_at',
				'final_answer',
				'answer_count',
				'hints_shown',
				'terminal_outcome',
				'experiment_key',
				'experiment_version',
				'displayed_variant',
				'created_at'
			],
			[
				attemptId,
				userId,
				row.questionId ?? '',
				row.apClass ?? '',
				row.unit ?? '',
				stringValue(row.selectedAnswer),
				row.wasCorrect == null ? null : boolValue(row.wasCorrect),
				row.timeTakenMs == null ? null : intValue(row.timeTakenMs),
				dateOf(row.attemptedAt, created),
				stringValue(row.finalAnswer),
				row.answerCount == null ? null : intValue(row.answerCount),
				row.hintsShown == null ? null : intValue(row.hintsShown),
				stringValue(row.terminalOutcome),
				stringValue(row.experimentKey),
				row.experimentVersion == null ? null : intValue(row.experimentVersion),
				stringValue(row.displayedVariant),
				created
			],
			'"id"',
			[
				'user_id',
				'question_id',
				'ap_class',
				'unit',
				'selected_answer',
				'was_correct',
				'time_taken_ms',
				'attempted_at',
				'final_answer',
				'answer_count',
				'hints_shown',
				'terminal_outcome',
				'experiment_key',
				'experiment_version',
				'displayed_variant'
			]
		);
	}
	for (const questionId of arrayValue(document.bookmarkedQuestions)) {
		await upsert(
			'app.bookmarks',
			['user_id', 'question_id', 'created_at'],
			[userId, String(questionId), created],
			'"user_id", "question_id"',
			['created_at']
		);
	}
	for (const assignment of arrayValue(document.practiceExperiments)) {
		const row = normalizeObject(assignment);
		await upsert(
			'app.experiment_assignments',
			['user_id', 'key', 'version', 'variant', 'created_at', 'updated_at'],
			[userId, row.key ?? '', intValue(row.version), row.variant ?? 'control', created, updated],
			'"user_id", "key"',
			['version', 'variant', 'updated_at']
		);
	}
	await recordLedger(collectionName, sourceId, 'app.user_profiles', userId, document);
}

async function migrateLegacyUser(collectionName: string, document: RawDocument): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	if (await targetHasRow('auth.users', 'id', sourceId)) {
		await recordLedger(collectionName, sourceId, 'auth.users', sourceId, document);
		return;
	}
	await archiveLegacyDocument(collectionName, sourceId, document);
}

async function migrateBetterAuthMigrationMap(
	collectionName: string,
	document: RawDocument
): Promise<void> {
	const sourceId = String(document.legacyUserId ?? '');
	const betterAuthUserId = String(document.betterAuthUserId ?? '');
	if (
		!sourceId ||
		!betterAuthUserId ||
		!(await targetHasRow('auth.users', 'id', betterAuthUserId))
	) {
		return archiveLegacyDocument(collectionName, requiredId(document, collectionName), document);
	}
	await upsert(
		'ops.better_auth_migration_map',
		[
			'legacy_user_id',
			'better_auth_user_id',
			'email',
			'has_credential',
			'has_google',
			'migrated_at',
			'status'
		],
		[
			sourceId,
			betterAuthUserId,
			document.email ?? '',
			boolValue(document.hasCredential),
			boolValue(document.hasGoogle),
			dateOf(document.migratedAt),
			document.status ?? 'unknown'
		],
		'"legacy_user_id"',
		['better_auth_user_id', 'email', 'has_credential', 'has_google', 'migrated_at', 'status']
	);
	await recordLedger(collectionName, sourceId, 'ops.better_auth_migration_map', sourceId, document);
}

async function migrateConversation(collectionName: string, document: RawDocument): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	const userId = String(document.userId ?? '');
	if (!userId || !(await targetHasRow('auth.users', 'id', userId)))
		return archiveLegacyDocument(collectionName, sourceId, document);
	const created = dateOf(document.createdAt);
	const updated = dateOf(document.updatedAt, created);
	await upsert(
		'app.conversations',
		['id', 'user_id', 'title', 'last_message_at', 'created_at', 'updated_at'],
		[
			sourceId,
			userId,
			document.title ?? 'New conversation',
			optionalDate(document.lastMessageAt),
			created,
			updated
		],
		'"id"',
		['user_id', 'title', 'last_message_at', 'updated_at']
	);
	for (const [position, message] of arrayValue(document.messages).entries()) {
		const row = normalizeObject(message);
		if (typeof row.role !== 'string' || typeof row.content !== 'string') {
			return reject(
				collectionName,
				sourceId,
				`conversation message ${position} is missing role/content`,
				document
			);
		}
		const messageId = stableId(sourceId, 'message', position, row.id ?? '');
		await upsert(
			'app.conversation_messages',
			['id', 'conversation_id', 'position', 'role', 'content', 'created_at'],
			[messageId, sourceId, position, row.role, row.content, dateOf(row.createdAt, created)],
			'"id"',
			['conversation_id', 'position', 'role', 'content', 'created_at']
		);
	}
	await recordLedger(collectionName, sourceId, 'app.conversations', sourceId, document);
}

async function migrateSeenQuestion(collectionName: string, document: RawDocument): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	const userId = String(document.userId ?? '');
	if (!userId || !(await targetHasRow('auth.users', 'id', userId)))
		return archiveLegacyDocument(collectionName, sourceId, document);
	if (!document.contentHash || !document.questionType || !document.apClass || !document.unit) {
		return reject(
			collectionName,
			sourceId,
			'seen question is missing a required dimension',
			document
		);
	}
	await upsert(
		'app.seen_questions',
		['id', 'user_id', 'content_hash', 'question_type', 'ap_class', 'unit', 'seen_at'],
		[
			sourceId,
			userId,
			String(document.contentHash),
			String(document.questionType),
			String(document.apClass),
			String(document.unit),
			dateOf(document.seenAt)
		],
		'"id"',
		['user_id', 'content_hash', 'question_type', 'ap_class', 'unit', 'seen_at']
	);
	await recordLedger(collectionName, sourceId, 'app.seen_questions', sourceId, document);
}

async function migrateQuestion(
	collectionName: string,
	document: RawDocument,
	kind: 'mcq' | 'frq'
): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	const questionId = String(document.s3QuestionId ?? document.questionId ?? sourceId);
	const created = dateOf(document.createdAt);
	const updated = dateOf(document.updatedAt, created);
	if (kind === 'frq' && document.contentHash) {
		const existing = await query(
			'SELECT question_id FROM content.frq_questions WHERE content_hash = $1 LIMIT 1',
			[String(document.contentHash)]
		);
		const existingQuestionId =
			existing[0] && typeof existing[0] === 'object'
				? String((existing[0] as { question_id?: unknown }).question_id ?? '')
				: '';
		if (existingQuestionId && existingQuestionId !== questionId) {
			await recordLedger(
				collectionName,
				sourceId,
				'content.frq_questions',
				existingQuestionId,
				document
			);
			return;
		}
	}
	await upsert(
		'content.question_registry',
		[
			'question_id',
			'kind',
			'ap_class',
			'unit',
			'question_created_at',
			'content_hash',
			'content_length',
			'created_at',
			'updated_at'
		],
		[
			questionId,
			kind,
			stringValue(document.apClass),
			stringValue(document.unit),
			created,
			stringValue(document.contentHash),
			intValue(document.contentLength, String(document.question ?? document.prompt ?? '').length),
			created,
			updated
		],
		'"question_id"',
		[
			'kind',
			'ap_class',
			'unit',
			'question_created_at',
			'content_hash',
			'content_length',
			'updated_at'
		]
	);
	if (kind === 'mcq') {
		await upsert(
			'content.mcq_questions',
			[
				'question_id',
				'ap_class',
				'unit',
				'content_hash',
				'topics_covered',
				'question',
				'option_a',
				'option_b',
				'option_c',
				'option_d',
				'correct_answer',
				'explanation',
				'hint_1',
				'hint_2',
				'random_key',
				'active',
				'created_at',
				'updated_at'
			],
			[
				questionId,
				document.apClass ?? '',
				document.unit ?? 'all-units',
				document.contentHash ?? '',
				stringValue(document.topicsCovered),
				document.question ?? '',
				document.optionA ?? '',
				document.optionB ?? '',
				document.optionC ?? '',
				document.optionD ?? '',
				document.correctAnswer ?? '',
				document.explanation ?? '',
				stringValue(document.hint1),
				stringValue(document.hint2),
				numberValue(document.randomKey, Math.random()),
				boolValue(document.active, true),
				created,
				updated
			],
			'"question_id"',
			[
				'ap_class',
				'unit',
				'content_hash',
				'topics_covered',
				'question',
				'option_a',
				'option_b',
				'option_c',
				'option_d',
				'correct_answer',
				'explanation',
				'hint_1',
				'hint_2',
				'random_key',
				'active',
				'updated_at'
			]
		);
	} else {
		await upsert(
			'content.frq_questions',
			[
				'question_id',
				'ap_class',
				'unit',
				'format_id',
				'profile_version',
				'prompt_version',
				'rubric_version',
				'schema_version',
				'prompt',
				'total_points',
				'topics_covered',
				'content_hash',
				'random_key',
				'active',
				'created_at',
				'updated_at'
			],
			[
				questionId,
				document.apClass ?? '',
				document.unit ?? '',
				document.formatId ?? '',
				document.profileVersion ?? '',
				document.promptVersion ?? '',
				document.rubricVersion ?? '',
				intValue(document.schemaVersion, 1),
				document.prompt ?? '',
				numberValue(document.totalPoints),
				document.topicsCovered ?? '',
				document.contentHash ?? '',
				numberValue(document.randomKey, Math.random()),
				boolValue(document.active, true),
				created,
				updated
			],
			'"question_id"',
			[
				'ap_class',
				'unit',
				'format_id',
				'profile_version',
				'prompt_version',
				'rubric_version',
				'schema_version',
				'prompt',
				'total_points',
				'topics_covered',
				'content_hash',
				'random_key',
				'active',
				'updated_at'
			]
		);
		for (const [position, material] of arrayValue(document.materials).entries()) {
			const row = normalizeObject(material);
			await upsert(
				'content.frq_materials',
				['question_id', 'material_id', 'title', 'content', 'position'],
				[
					questionId,
					row.id ?? String(position),
					stringValue(row.title),
					row.content ?? '',
					position
				],
				'"question_id", "material_id"',
				['title', 'content', 'position']
			);
		}
		for (const [position, section] of arrayValue(document.sections).entries()) {
			const row = normalizeObject(section);
			await upsert(
				'content.frq_sections',
				['question_id', 'section_id', 'label', 'prompt', 'response_kind', 'max_points', 'position'],
				[
					questionId,
					row.id ?? String(position),
					row.label ?? '',
					row.prompt ?? '',
					row.responseKind ?? 'text',
					numberValue(row.maxPoints),
					position
				],
				'"question_id", "section_id"',
				['label', 'prompt', 'response_kind', 'max_points', 'position']
			);
		}
		for (const [position, criterion] of arrayValue(document.rubric).entries()) {
			const row = normalizeObject(criterion);
			const criterionId = String(row.id ?? position);
			await upsert(
				'content.frq_rubric_criteria',
				[
					'question_id',
					'criterion_id',
					'section_id',
					'label',
					'max_points',
					'reference_answer',
					'position'
				],
				[
					questionId,
					criterionId,
					row.sectionId ?? '',
					row.label ?? '',
					numberValue(row.maxPoints),
					row.referenceAnswer ?? '',
					position
				],
				'"question_id", "criterion_id"',
				['section_id', 'label', 'max_points', 'reference_answer', 'position']
			);
			for (const [levelPosition, level] of arrayValue(row.levels).entries()) {
				const levelRow = normalizeObject(level);
				await upsert(
					'content.frq_rubric_levels',
					['question_id', 'criterion_id', 'points', 'description', 'position'],
					[
						questionId,
						criterionId,
						numberValue(levelRow.points),
						levelRow.description ?? '',
						levelPosition
					],
					'"question_id", "criterion_id", "points"',
					['description', 'position']
				);
			}
		}
	}
	await recordLedger(collectionName, sourceId, `content.${kind}_questions`, questionId, document);
}

async function migrateQuestionRegistry(
	collectionName: string,
	document: RawDocument
): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	const questionId = String(document.questionId ?? sourceId);
	const created = dateOf(document.createdAt);
	const updated = dateOf(document.updatedAt, created);
	const kind = document.kind === 'frq' || String(questionId).startsWith('frq') ? 'frq' : 'mcq';
	await upsert(
		'content.question_registry',
		[
			'question_id',
			'kind',
			'ap_class',
			'unit',
			'question_created_at',
			's3_etag',
			'content_hash',
			'content_length',
			'metadata_synced_at',
			'created_at',
			'updated_at'
		],
		[
			questionId,
			kind,
			stringValue(document.apClass),
			stringValue(document.unit),
			optionalDate(document.questionCreatedAt),
			stringValue(document.s3Etag),
			stringValue(document.contentHash),
			document.contentLength == null ? null : intValue(document.contentLength),
			optionalDate(document.metadataSyncedAt),
			created,
			updated
		],
		'"question_id"',
		[
			'kind',
			'ap_class',
			'unit',
			'question_created_at',
			's3_etag',
			'content_hash',
			'content_length',
			'metadata_synced_at',
			'updated_at'
		]
	);
	await recordLedger(collectionName, sourceId, 'content.question_registry', questionId, document);
}

async function migrateFrqAttempt(collectionName: string, document: RawDocument): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	const userId = String(document.userId ?? '');
	if (!userId || !(await targetHasRow('auth.users', 'id', userId)))
		return archiveLegacyDocument(collectionName, sourceId, document);
	const id = sourceId;
	const created = dateOf(document.createdAt);
	const updated = dateOf(document.updatedAt, created);
	await upsert(
		'app.frq_attempts',
		[
			'id',
			'user_id',
			'submission_id',
			'question_id',
			'ap_class',
			'unit',
			'format_id',
			'responses',
			'status',
			'time_taken_ms',
			'profile_version',
			'rubric_version',
			'prompt_version',
			'grading_model',
			'created_at',
			'updated_at'
		],
		[
			id,
			document.userId ?? '',
			document.submissionId ?? id,
			document.questionId ?? '',
			document.apClass ?? '',
			document.unit ?? '',
			document.formatId ?? '',
			jsonValue(document.responses),
			document.status ?? 'grading',
			intValue(document.timeTakenMs),
			document.profileVersion ?? '',
			document.rubricVersion ?? '',
			document.promptVersion ?? '',
			stringValue(document.gradingModel),
			created,
			updated
		],
		'"id"',
		[
			'user_id',
			'submission_id',
			'question_id',
			'ap_class',
			'unit',
			'format_id',
			'responses',
			'status',
			'time_taken_ms',
			'profile_version',
			'rubric_version',
			'prompt_version',
			'grading_model',
			'updated_at'
		]
	);
	const grade = normalizeObject(document.grade);
	if (Object.keys(grade).length) {
		await upsert(
			'app.frq_attempt_grades',
			['attempt_id', 'points_earned', 'points_available', 'percentage', 'overall_feedback'],
			[
				id,
				numberValue(grade.pointsEarned),
				numberValue(grade.pointsAvailable),
				numberValue(grade.percentage),
				grade.overallFeedback ?? ''
			],
			'"attempt_id"',
			['points_earned', 'points_available', 'percentage', 'overall_feedback']
		);
		for (const criterion of arrayValue(grade.criteria)) {
			const row = normalizeObject(criterion);
			await upsert(
				'app.frq_attempt_criterion_grades',
				[
					'attempt_id',
					'criterion_id',
					'section_id',
					'label',
					'points',
					'points_available',
					'evidence',
					'feedback'
				],
				[
					id,
					row.criterionId ?? '',
					row.sectionId ?? '',
					row.label ?? '',
					numberValue(row.points),
					numberValue(row.pointsAvailable),
					row.evidence ?? '',
					row.feedback ?? ''
				],
				'"attempt_id", "criterion_id"',
				['section_id', 'label', 'points', 'points_available', 'evidence', 'feedback']
			);
		}
	}
	await recordLedger(collectionName, sourceId, 'app.frq_attempts', id, document);
}

async function migrateSuper(collectionName: string, document: RawDocument): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	const userId = String(document.userId ?? '');
	if (!userId || !(await targetHasRow('auth.users', 'id', userId)))
		return archiveLegacyDocument(collectionName, sourceId, document);
	const created = dateOf(document.createdAt);
	const updated = dateOf(document.updatedAt, created);
	if (collectionName === 'tutor_profiles') {
		await upsert(
			'app.tutor_profiles',
			[
				'user_id',
				'age_confirmed_at',
				'mem0_user_id',
				'study_availability',
				'teaching_style',
				'memory_enabled',
				'memory_disclosure_seen_at',
				'super_free_beta_claimed_at',
				'super_access_started_at',
				'super_ended_at',
				'memory_purged_at',
				'created_at',
				'updated_at'
			],
			[
				userId,
				optionalDate(document.ageConfirmedAt),
				document.mem0UserId ?? '',
				document.studyAvailability ?? '',
				document.teachingStyle ?? 'socratic',
				boolValue(document.memoryEnabled, true),
				optionalDate(document.memoryDisclosureSeenAt),
				optionalDate(document.superFreeBetaClaimedAt),
				optionalDate(document.superAccessStartedAt),
				optionalDate(document.superEndedAt),
				optionalDate(document.memoryPurgedAt),
				created,
				updated
			],
			'"user_id"',
			[
				'age_confirmed_at',
				'mem0_user_id',
				'study_availability',
				'teaching_style',
				'memory_enabled',
				'memory_disclosure_seen_at',
				'super_free_beta_claimed_at',
				'super_access_started_at',
				'super_ended_at',
				'memory_purged_at',
				'updated_at'
			]
		);
		for (const [position, apClass] of arrayValue(document.selectedApClasses).entries())
			await upsert(
				'app.tutor_profile_classes',
				['user_id', 'ap_class', 'position'],
				[userId, String(apClass), position],
				'"user_id", "ap_class"',
				['position']
			);
		for (const target of arrayValue(document.targetDates)) {
			const row = normalizeObject(target);
			await upsert(
				'app.tutor_target_dates',
				['user_id', 'ap_class', 'target_date'],
				[userId, row.apClass ?? '', dateOf(row.targetDate)],
				'"user_id", "ap_class"',
				['target_date']
			);
		}
	} else if (collectionName === 'super_billing_access') {
		await upsert(
			'app.super_billing_access',
			[
				'id',
				'user_id',
				'stripe_customer_id',
				'stripe_subscription_id',
				'plan',
				'status',
				'period_start',
				'period_end',
				'cancel_at_period_end',
				'cancel_at',
				'past_due_since',
				'super_ended_at',
				'billing_issue',
				'billing_issue_at',
				'last_stripe_event_id',
				'last_stripe_event_created',
				'last_billing_event_created',
				'created_at',
				'updated_at'
			],
			[
				sourceId,
				document.userId ?? '',
				stringValue(document.stripeCustomerId),
				stringValue(document.stripeSubscriptionId),
				document.plan ?? 'super',
				document.status ?? 'incomplete',
				optionalDate(document.periodStart),
				optionalDate(document.periodEnd),
				boolValue(document.cancelAtPeriodEnd),
				optionalDate(document.cancelAt),
				optionalDate(document.pastDueSince),
				optionalDate(document.superEndedAt),
				stringValue(document.billingIssue),
				optionalDate(document.billingIssueAt),
				stringValue(document.lastStripeEventId),
				optionalDate(document.lastStripeEventCreated),
				optionalDate(document.lastBillingEventCreated),
				created,
				updated
			],
			'"id"',
			[
				'user_id',
				'stripe_customer_id',
				'stripe_subscription_id',
				'plan',
				'status',
				'period_start',
				'period_end',
				'cancel_at_period_end',
				'cancel_at',
				'past_due_since',
				'super_ended_at',
				'billing_issue',
				'billing_issue_at',
				'last_stripe_event_id',
				'last_stripe_event_created',
				'last_billing_event_created',
				'updated_at'
			]
		);
	} else if (collectionName === 'super_grants') {
		await upsert(
			'app.super_grants',
			[
				'id',
				'user_id',
				'starts_at',
				'expires_at',
				'reason',
				'created_by',
				'revoked_at',
				'created_at',
				'updated_at'
			],
			[
				sourceId,
				document.userId ?? '',
				dateOf(document.startsAt),
				dateOf(document.expiresAt),
				document.reason ?? '',
				document.createdBy ?? '',
				optionalDate(document.revokedAt),
				created,
				updated
			],
			'"id"',
			['user_id', 'starts_at', 'expires_at', 'reason', 'created_by', 'revoked_at', 'updated_at']
		);
	} else if (collectionName === 'super_usage_rollups') {
		await upsert(
			'app.super_usage_rollups',
			['user_id', 'month', 'personalized_messages', 'updated_at'],
			[
				document.userId ?? '',
				document.month ?? '',
				intValue(document.personalizedMessages),
				updated
			],
			'"user_id", "month"',
			['personalized_messages', 'updated_at']
		);
	} else if (collectionName === 'insight_reports') {
		await upsert(
			'app.insight_reports',
			[
				'id',
				'user_id',
				'report',
				'evidence_attempt_count',
				'generated_at',
				'manual',
				'pdf_data',
				'pdf_generated_at',
				'pdf_generation_version',
				'feedback',
				'feedback_reason',
				'locked_at',
				'created_at',
				'updated_at'
			],
			[
				sourceId,
				document.userId ?? '',
				jsonValue(document.report),
				intValue(document.evidenceAttemptCount),
				dateOf(document.generatedAt, created),
				boolValue(document.manual),
				document.pdfData ?? null,
				optionalDate(document.pdfGeneratedAt),
				document.pdfGenerationVersion == null ? null : intValue(document.pdfGenerationVersion),
				stringValue(document.feedback),
				stringValue(document.feedbackReason),
				optionalDate(document.lockedAt),
				created,
				updated
			],
			'"id"',
			[
				'user_id',
				'report',
				'evidence_attempt_count',
				'generated_at',
				'manual',
				'pdf_data',
				'pdf_generated_at',
				'pdf_generation_version',
				'feedback',
				'feedback_reason',
				'locked_at',
				'updated_at'
			]
		);
	} else if (collectionName === 'study_plans') {
		const userId = String(document.userId ?? '');
		await upsert(
			'app.study_plans',
			['id', 'user_id', 'starts_on', 'created_at', 'updated_at'],
			[sourceId, userId, dateOf(document.startsOn, created), created, updated],
			'"id"',
			['user_id', 'starts_on', 'updated_at']
		);
		for (const task of arrayValue(document.tasks)) {
			const row = normalizeObject(task);
			const taskId = String(row.id ?? stableId(sourceId, 'task', jsonValue(row)));
			await upsert(
				'app.study_tasks',
				[
					'id',
					'plan_id',
					'ap_class',
					'unit',
					'mode',
					'task_date',
					'duration_minutes',
					'status',
					'practice_href'
				],
				[
					taskId,
					sourceId,
					row.apClass ?? '',
					row.unit ?? '',
					row.mode ?? 'review',
					dateOf(row.date),
					intValue(row.durationMinutes, 30),
					row.status ?? 'todo',
					stringValue(row.practiceHref)
				],
				'"id"',
				[
					'plan_id',
					'ap_class',
					'unit',
					'mode',
					'task_date',
					'duration_minutes',
					'status',
					'practice_href'
				]
			);
		}
	} else if (collectionName === 'study_plan_audits') {
		await upsert(
			'app.study_plan_audits',
			['id', 'user_id', 'action', 'before', 'after', 'undone_at', 'created_at', 'updated_at'],
			[
				sourceId,
				document.userId ?? '',
				document.action ?? '',
				jsonValue(document.before),
				jsonValue(document.after),
				optionalDate(document.undoneAt),
				created,
				updated
			],
			'"id"',
			['user_id', 'action', 'before', 'after', 'undone_at', 'updated_at']
		);
	} else if (collectionName === 'coach_audits') {
		await upsert(
			'app.coach_audits',
			[
				'id',
				'user_id',
				'session_id',
				'tool_name',
				'before',
				'after',
				'model_id',
				'undone_at',
				'created_at',
				'updated_at'
			],
			[
				sourceId,
				document.userId ?? '',
				document.sessionId ?? '',
				document.toolName ?? '',
				jsonValue(document.before),
				jsonValue(document.after),
				document.modelId ?? '',
				optionalDate(document.undoneAt),
				created,
				updated
			],
			'"id"',
			[
				'user_id',
				'session_id',
				'tool_name',
				'before',
				'after',
				'model_id',
				'undone_at',
				'updated_at'
			]
		);
	} else if (collectionName === 'super_cleanup_jobs') {
		await upsert(
			'ops.super_cleanup_jobs',
			[
				'id',
				'user_id',
				'mem0_user_id',
				'kind',
				'next_attempt_at',
				'attempts',
				'last_error',
				'completed_at',
				'created_at',
				'updated_at'
			],
			[
				sourceId,
				document.userId ?? '',
				document.mem0UserId ?? '',
				document.kind ?? '',
				dateOf(document.nextAttemptAt),
				intValue(document.attempts),
				stringValue(document.lastError),
				optionalDate(document.completedAt),
				created,
				updated
			],
			'"id"',
			[
				'user_id',
				'mem0_user_id',
				'kind',
				'next_attempt_at',
				'attempts',
				'last_error',
				'completed_at',
				'updated_at'
			]
		);
	}
	await recordLedger(collectionName, sourceId, `app.${collectionName}`, sourceId, document);
}

async function migrateQuality(collectionName: string, document: RawDocument): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	const created = dateOf(document.createdAt);
	const updated = dateOf(document.updatedAt, created);
	if (collectionName === 'question_quality') {
		const summary = normalizeObject(document.feedbackSummary);
		await upsert(
			'content.question_quality',
			[
				'question_id',
				'source_hash',
				'source_etag',
				'source_created_at',
				'ap_class',
				'unit',
				'state',
				'ai_assessment',
				'human_assessment',
				'final_verdict',
				'final_source',
				'finalized_at',
				'needs_human_review',
				'human_review_reason',
				'blind_human_review',
				'answer_incorrect_count',
				'question_unclear_count',
				'explanation_unclear_count',
				'unique_reporters',
				'feedback_priority',
				'created_at',
				'updated_at'
			],
			[
				document.questionId ?? sourceId,
				stringValue(document.sourceHash),
				stringValue(document.sourceEtag),
				optionalDate(document.sourceCreatedAt),
				stringValue(document.apClass),
				stringValue(document.unit),
				document.state ?? 'unreviewed',
				jsonValue(document.aiAssessment),
				jsonValue(document.humanAssessment),
				stringValue(document.finalVerdict),
				stringValue(document.finalSource),
				optionalDate(document.finalizedAt),
				boolValue(document.needsHumanReview),
				stringValue(document.humanReviewReason),
				boolValue(document.blindHumanReview),
				intValue(summary.answerIncorrect),
				intValue(summary.questionUnclear),
				intValue(summary.explanationUnclear),
				intValue(summary.uniqueReporters),
				summary.priority ?? 'none',
				created,
				updated
			],
			'"question_id"',
			[
				'source_hash',
				'source_etag',
				'source_created_at',
				'ap_class',
				'unit',
				'state',
				'ai_assessment',
				'human_assessment',
				'final_verdict',
				'final_source',
				'finalized_at',
				'needs_human_review',
				'human_review_reason',
				'blind_human_review',
				'answer_incorrect_count',
				'question_unclear_count',
				'explanation_unclear_count',
				'unique_reporters',
				'feedback_priority',
				'updated_at'
			]
		);
		for (const [position, audit] of arrayValue(document.audit).entries()) {
			const row = normalizeObject(audit);
			await upsert(
				'content.question_quality_audits',
				['id', 'question_id', 'at', 'actor_id', 'action', 'from_verdict', 'to_verdict', 'note'],
				[
					stableId(sourceId, 'audit', position),
					document.questionId ?? sourceId,
					dateOf(row.at, created),
					row.actorId ?? '',
					row.action ?? '',
					stringValue(row.fromVerdict),
					stringValue(row.toVerdict),
					stringValue(row.note)
				],
				'"id"',
				['at', 'actor_id', 'action', 'from_verdict', 'to_verdict', 'note']
			);
		}
	} else if (collectionName === 'question_quality_feedback') {
		await upsert(
			'content.question_feedback',
			['id', 'question_id', 'user_id', 'type', 'ap_class', 'unit', 'created_at', 'updated_at'],
			[
				sourceId,
				document.questionId ?? '',
				document.userId ?? '',
				document.type ?? '',
				stringValue(document.apClass),
				stringValue(document.unit),
				created,
				updated
			],
			'"id"',
			['question_id', 'user_id', 'type', 'ap_class', 'unit', 'updated_at']
		);
	} else if (collectionName === 'question_quality_review_jobs') {
		await upsert(
			'content.quality_review_jobs',
			[
				'id',
				'status',
				'filters',
				'selected_count',
				'skipped_count',
				'queued_count',
				'submitted_count',
				'awaiting_human_count',
				'final_count',
				'failed_count',
				'estimated_input_tokens',
				'estimated_output_tokens',
				'estimated_maximum_cost_usd',
				'actual_cost_usd',
				'model',
				'rubric_version',
				'calibrated',
				'created_by',
				'expires_at',
				'active_batch_id',
				'active_input_file_id',
				'active_output_file_id',
				'active_submission_key',
				'processing_lease_until',
				'submission_lease_until',
				'error',
				'created_at',
				'updated_at'
			],
			[
				sourceId,
				document.status ?? 'preview',
				jsonValue(document.filters),
				intValue(document.selectedCount),
				intValue(document.skippedCount),
				intValue(document.queuedCount),
				intValue(document.submittedCount),
				intValue(document.awaitingHumanCount),
				intValue(document.finalCount),
				intValue(document.failedCount),
				intValue(document.estimatedInputTokens),
				intValue(document.estimatedOutputTokens),
				numberValue(document.estimatedMaximumCostUsd),
				numberValue(document.actualCostUsd),
				document.model ?? '',
				document.rubricVersion ?? '',
				boolValue(document.calibrated),
				document.createdBy ?? '',
				optionalDate(document.expiresAt),
				stringValue(document.activeBatchId),
				stringValue(document.activeInputFileId),
				stringValue(document.activeOutputFileId),
				stringValue(document.activeSubmissionKey),
				optionalDate(document.processingLeaseUntil),
				optionalDate(document.submissionLeaseUntil),
				stringValue(document.error),
				created,
				updated
			],
			'"id"',
			[
				'status',
				'filters',
				'selected_count',
				'skipped_count',
				'queued_count',
				'submitted_count',
				'awaiting_human_count',
				'final_count',
				'failed_count',
				'estimated_input_tokens',
				'estimated_output_tokens',
				'estimated_maximum_cost_usd',
				'actual_cost_usd',
				'model',
				'rubric_version',
				'calibrated',
				'created_by',
				'expires_at',
				'active_batch_id',
				'active_input_file_id',
				'active_output_file_id',
				'active_submission_key',
				'processing_lease_until',
				'submission_lease_until',
				'error',
				'updated_at'
			]
		);
		for (const [position, questionId] of arrayValue(document.selectedQuestionIds).entries())
			await upsert(
				'content.quality_review_job_candidates',
				['job_id', 'question_id', 'position', 'selected'],
				[sourceId, String(questionId), position, true],
				'"job_id", "question_id"',
				['position', 'selected']
			);
		for (const [position, batch] of arrayValue(document.batches).entries()) {
			const row = normalizeObject(batch);
			await upsert(
				'content.quality_review_batches',
				[
					'id',
					'job_id',
					'submission_key',
					'input_file_id',
					'batch_id',
					'status',
					'output_file_id',
					'error_file_id',
					'created_at',
					'completed_at'
				],
				[
					stableId(sourceId, 'batch', position, row.submissionKey),
					sourceId,
					row.submissionKey ?? '',
					row.inputFileId ?? '',
					stringValue(row.batchId),
					row.status ?? '',
					stringValue(row.outputFileId),
					stringValue(row.errorFileId),
					dateOf(row.createdAt, created),
					optionalDate(row.completedAt)
				],
				'"id"',
				[
					'job_id',
					'submission_key',
					'input_file_id',
					'batch_id',
					'status',
					'output_file_id',
					'error_file_id',
					'completed_at'
				]
			);
		}
	} else if (collectionName === 'question_quality_review_job_items') {
		await upsert(
			'content.quality_review_job_items',
			[
				'id',
				'job_id',
				'question_id',
				'status',
				'attempts',
				'batch_id',
				'submission_key',
				'blind',
				'requires_web_search',
				'error',
				'created_at',
				'updated_at'
			],
			[
				sourceId,
				idOf(document.jobId),
				document.questionId ?? '',
				document.status ?? 'queued',
				intValue(document.attempts),
				stringValue(document.batchId),
				stringValue(document.submissionKey),
				boolValue(document.blind),
				boolValue(document.requiresWebSearch, true),
				stringValue(document.error),
				created,
				updated
			],
			'"id"',
			[
				'job_id',
				'question_id',
				'status',
				'attempts',
				'batch_id',
				'submission_key',
				'blind',
				'requires_web_search',
				'error',
				'updated_at'
			]
		);
	}
	await recordLedger(collectionName, sourceId, `content.${collectionName}`, sourceId, document);
}

async function migrateOperations(collectionName: string, document: RawDocument): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	const created = dateOf(document.createdAt);
	const updated = dateOf(document.updatedAt, created);
	if (collectionName === 'poolrefillstates') {
		await upsert(
			'ops.pool_refill_states',
			[
				'id',
				'question_type',
				'ap_class',
				'unit',
				'status',
				'target',
				'observed_count',
				'requested_at',
				'lease_owner',
				'lease_expires_at',
				'attempts',
				'generated_count',
				'last_error',
				'next_attempt_at',
				'last_success_at',
				'created_at',
				'updated_at'
			],
			[
				sourceId,
				document.questionType ?? 'mcq',
				document.apClass ?? '',
				document.unit ?? '',
				document.status ?? 'pending',
				intValue(document.target),
				intValue(document.observedCount),
				dateOf(document.requestedAt, created),
				stringValue(document.leaseOwner),
				optionalDate(document.leaseExpiresAt),
				intValue(document.attempts),
				intValue(document.generatedCount),
				stringValue(document.lastError),
				optionalDate(document.nextAttemptAt),
				optionalDate(document.lastSuccessAt),
				created,
				updated
			],
			'"question_type", "ap_class", "unit"',
			[
				'id',
				'status',
				'target',
				'observed_count',
				'requested_at',
				'lease_owner',
				'lease_expires_at',
				'attempts',
				'generated_count',
				'last_error',
				'next_attempt_at',
				'last_success_at',
				'updated_at'
			]
		);
	} else if (collectionName === 'poolbucketwritelocks') {
		await upsert(
			'ops.pool_bucket_write_locks',
			[
				'id',
				'question_type',
				'ap_class',
				'unit',
				'lease_owner',
				'lease_expires_at',
				'created_at',
				'updated_at'
			],
			[
				sourceId,
				document.questionType ?? 'mcq',
				document.apClass ?? '',
				document.unit ?? '',
				stringValue(document.leaseOwner),
				optionalDate(document.leaseExpiresAt),
				created,
				updated
			],
			'"question_type", "ap_class", "unit"',
			['id', 'lease_owner', 'lease_expires_at', 'updated_at']
		);
	} else if (collectionName === 'poolgenerationbudgets') {
		await upsert(
			'ops.pool_generation_budgets',
			['day_key', 'generations', 'created_at', 'updated_at'],
			[document.dayKey ?? sourceId, intValue(document.generations), created, updated],
			'"day_key"',
			['generations', 'updated_at']
		);
	}
	await recordLedger(collectionName, sourceId, `ops.${collectionName}`, sourceId, document);
}

async function migrateGenerationRollup(
	collectionName: string,
	document: RawDocument
): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	const isClass = collectionName === 'questiongenclasstotals';
	const isUnitDetail = collectionName === 'questiongenunitdetails';
	const apClass = isClass || isUnitDetail ? stringValue(document.apClass) : null;
	const unit =
		isUnitDetail || collectionName === 'questiongenunitglobals' ? stringValue(document.unit) : null;
	const id = stableId('generation-rollup', collectionName, apClass ?? '', unit ?? '');
	await upsert(
		'ops.generation_rollup_snapshots',
		['id', 'source_collection', 'ap_class', 'unit', 'count', 'total_question_chars'],
		[
			id,
			collectionName,
			apClass,
			unit,
			intValue(document.count),
			intValue(document.totalQuestionChars)
		],
		'"source_collection", "ap_class", "unit"',
		['id', 'count', 'total_question_chars']
	);
	await recordLedger(collectionName, sourceId, 'ops.generation_rollup_snapshots', id, document);
}

async function migrateReferral(collectionName: string, document: RawDocument): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	const referrerUserId = String(document.referrerUserId ?? '');
	const referredUserId = String(document.referredUserId ?? '');
	if (
		!referrerUserId ||
		!referredUserId ||
		!(await targetHasRow('auth.users', 'id', referrerUserId)) ||
		!(await targetHasRow('auth.users', 'id', referredUserId))
	) {
		return archiveLegacyDocument(collectionName, sourceId, document);
	}
	const created = dateOf(document.createdAt);
	const updated = dateOf(document.updatedAt, created);
	await upsert(
		'app.referrals',
		['id', 'referrer_user_id', 'referred_user_id', 'activated_at', 'created_at', 'updated_at'],
		[
			sourceId,
			referrerUserId,
			referredUserId,
			optionalDate(document.activatedAt),
			created,
			updated
		],
		'"id"',
		['referrer_user_id', 'referred_user_id', 'activated_at', 'updated_at']
	);
	await recordLedger(collectionName, sourceId, 'app.referrals', sourceId, document);
}

async function migrateRecentTopic(
	collectionName: string,
	document: RawDocument,
	kind: 'mcq' | 'frq'
): Promise<void> {
	const sourceId = requiredId(document, collectionName);
	await upsert(
		'content.question_recent_topics',
		['id', 'kind', 'ap_class', 'unit', 'topics_covered', 'question_id', 'created_at'],
		[
			sourceId,
			kind,
			document.apClass ?? '',
			document.unit ?? '',
			document.topicsCovered ?? '',
			stringValue(document.s3QuestionId),
			dateOf(document.createdAt)
		],
		'"id"',
		['kind', 'ap_class', 'unit', 'topics_covered', 'question_id', 'created_at']
	);
	await recordLedger(
		collectionName,
		sourceId,
		'content.question_recent_topics',
		sourceId,
		document
	);
}

async function load(db: Db): Promise<void> {
	await eachDocument(
		db,
		[
			'authUsers',
			'authSessions',
			'authAccounts',
			'authVerifications',
			'authSubscriptions',
			'rateLimit'
		],
		migrateAuth
	);
	await eachDocument(db, ['betterAuthMigrationMap'], migrateBetterAuthMigrationMap);
	await eachDocument(db, ['userprofiles'], migrateProfile);
	await eachDocument(db, ['users'], migrateLegacyUser);
	await eachDocument(db, ['conversations'], migrateConversation);
	await eachDocument(db, ['seenquestions'], migrateSeenQuestion);
	await eachDocument(db, ['question_ids'], migrateQuestionRegistry);
	await eachDocument(db, [...mcqPoolNames], (collection, document) =>
		migrateQuestion(collection, document, 'mcq')
	);
	await eachDocument(db, ['frqquestions_pool_v2'], (collection, document) =>
		migrateQuestion(collection, document, 'frq')
	);
	await eachDocument(db, ['frqquestions'], (collection, document) =>
		migrateQuestion(collection, document, 'frq')
	);
	await eachDocument(db, ['frqattempts'], migrateFrqAttempt);
	await eachDocument(db, ['referrals'], migrateReferral);
	await eachDocument(
		db,
		[
			'tutor_profiles',
			'super_billing_access',
			'super_grants',
			'super_usage_rollups',
			'insight_reports',
			'study_plans',
			'study_plan_audits',
			'coach_audits',
			'super_cleanup_jobs'
		],
		migrateSuper
	);
	await eachDocument(
		db,
		[
			'question_quality',
			'question_quality_feedback',
			'question_quality_review_jobs',
			'question_quality_review_job_items'
		],
		migrateQuality
	);
	await eachDocument(
		db,
		['poolrefillstates', 'poolbucketwritelocks', 'poolgenerationbudgets'],
		migrateOperations
	);
	await eachDocument(
		db,
		['questiongenclasstotals', 'questiongenunitdetails', 'questiongenunitglobals'],
		migrateGenerationRollup
	);
	await eachDocument(db, ['questionrecenttopics'], (collection, document) =>
		migrateRecentTopic(collection, document, 'mcq')
	);
	await eachDocument(db, ['frqrecenttopics'], (collection, document) =>
		migrateRecentTopic(collection, document, 'frq')
	);

	const collections = await sourceCollections(db);
	const unexpected = collections.filter(
		(name) =>
			!knownCollections.has(name) &&
			!mcqPoolNames.has(name) &&
			!frqPoolNames.has(name) &&
			name !== 'frqrecenttopics'
	);
	if (unexpected.length)
		throw new Error(`Unmapped Mongo collections after load: ${unexpected.join(', ')}`);
}

async function verify(db: Db): Promise<void> {
	const collections = await sourceCollections(db);
	for (const collectionName of collections) {
		if (
			!knownCollections.has(collectionName) &&
			!mcqPoolNames.has(collectionName) &&
			!frqPoolNames.has(collectionName) &&
			collectionName !== 'frqrecenttopics'
		)
			continue;
		const count = await db.collection(collectionName).countDocuments();
		console.log(
			JSON.stringify({ phase: 'verify-source-count', collection: collectionName, count })
		);
	}
	const targetRows = await query(
		'SELECT target_table, COUNT(*)::int AS count FROM ops.migration_ledger WHERE run_id = $1 GROUP BY target_table ORDER BY target_table',
		[runId]
	);
	for (const row of targetRows)
		console.log(JSON.stringify({ phase: 'verify-target-ledger', ...row }));
	const targetTables = [
		'auth.users',
		'auth.accounts',
		'auth.sessions',
		'auth.subscriptions',
		'auth.rate_limits',
		'app.user_profiles',
		'app.user_subjects',
		'app.user_progress',
		'app.conversations',
		'app.conversation_messages',
		'app.seen_questions',
		'app.tutor_profiles',
		'app.tutor_profile_classes',
		'app.tutor_target_dates',
		'content.question_registry',
		'content.mcq_questions',
		'content.frq_questions',
		'content.frq_materials',
		'content.frq_sections',
		'content.frq_rubric_criteria',
		'content.frq_rubric_levels',
		'content.question_recent_topics',
		'ops.better_auth_migration_map',
		'ops.generation_rollup_snapshots',
		'ops.legacy_documents',
		'ops.migration_transforms'
	] as const;
	for (const table of targetTables) {
		const rows = await query(`SELECT COUNT(*)::int AS count FROM ${table}`);
		const count = Number((rows[0] as { count?: unknown } | undefined)?.count ?? 0);
		console.log(JSON.stringify({ phase: 'verify-target-count', target_table: table, count }));
	}
	const integrityChecks = [
		[
			'profiles-without-users',
			'SELECT COUNT(*)::int AS count FROM app.user_profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id)'
		],
		[
			'conversations-without-users',
			'SELECT COUNT(*)::int AS count FROM app.conversations c WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.user_id)'
		],
		[
			'messages-without-conversations',
			'SELECT COUNT(*)::int AS count FROM app.conversation_messages m WHERE NOT EXISTS (SELECT 1 FROM app.conversations c WHERE c.id = m.conversation_id)'
		],
		[
			'mcq-without-registry',
			'SELECT COUNT(*)::int AS count FROM content.mcq_questions q WHERE NOT EXISTS (SELECT 1 FROM content.question_registry r WHERE r.question_id = q.question_id)'
		],
		[
			'frq-without-registry',
			'SELECT COUNT(*)::int AS count FROM content.frq_questions q WHERE NOT EXISTS (SELECT 1 FROM content.question_registry r WHERE r.question_id = q.question_id)'
		],
		[
			'frq-materials-without-questions',
			'SELECT COUNT(*)::int AS count FROM content.frq_materials m WHERE NOT EXISTS (SELECT 1 FROM content.frq_questions q WHERE q.question_id = m.question_id)'
		],
		[
			'frq-sections-without-questions',
			'SELECT COUNT(*)::int AS count FROM content.frq_sections s WHERE NOT EXISTS (SELECT 1 FROM content.frq_questions q WHERE q.question_id = s.question_id)'
		],
		[
			'frq-criteria-without-questions',
			'SELECT COUNT(*)::int AS count FROM content.frq_rubric_criteria c WHERE NOT EXISTS (SELECT 1 FROM content.frq_questions q WHERE q.question_id = c.question_id)'
		],
		[
			'frq-levels-without-criteria',
			'SELECT COUNT(*)::int AS count FROM content.frq_rubric_levels l WHERE NOT EXISTS (SELECT 1 FROM content.frq_rubric_criteria c WHERE c.question_id = l.question_id AND c.criterion_id = l.criterion_id)'
		],
		[
			'ledger-without-run',
			'SELECT COUNT(*)::int AS count FROM ops.migration_ledger l WHERE NOT EXISTS (SELECT 1 FROM ops.migration_runs r WHERE r.id = l.run_id)'
		]
	] as const;
	for (const [name, statement] of integrityChecks) {
		const rows = await query(statement);
		const count = Number((rows[0] as { count?: unknown } | undefined)?.count ?? 0);
		console.log(JSON.stringify({ phase: 'verify-integrity', check: name, count }));
		if (count !== 0) throw new Error(`Migration integrity check failed: ${name}=${count}`);
	}
	const rejectRows = await query(
		'SELECT source_collection, COUNT(*)::int AS count FROM ops.migration_rejects WHERE run_id = $1 GROUP BY source_collection ORDER BY source_collection',
		[runId]
	);
	if (rejectRows.length)
		throw new Error(`Migration has rejected documents: ${JSON.stringify(rejectRows)}`);
}

async function main(): Promise<void> {
	const client = new MongoClient(sourceUri!);
	await client.connect();
	try {
		const db = client.db();
		if (phase === 'inventory') {
			await inventory(db);
			return;
		}
		await createRun();
		if (phase === 'load') await load(db);
		if (phase === 'verify') await verify(db);
		await completeRun('completed');
	} catch (error) {
		await completeRun('failed', error).catch(() => undefined);
		throw error;
	} finally {
		await client.close();
	}
}

void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
