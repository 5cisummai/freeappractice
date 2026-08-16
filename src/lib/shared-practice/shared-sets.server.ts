import { randomBytes, randomUUID } from 'node:crypto';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { assertCanAttachSharedSetToOrganization } from '$lib/auth/organization-queries.server';
import { OrganizationPermissionError } from '$lib/auth/organization-types';
import { getNeonDatabase } from '$lib/server/neon/db';
import { authUsers, sharedPracticeSetItems, sharedPracticeSets } from '$lib/server/neon/schema';
import {
	getQuestionsLookupMap,
	type StoredQuestion
} from '$lib/question-bank/mcq/repository.server';
import type { GeneratedQuestion } from '$lib/question-bank/mcq/types';
import type { SharedQuizView } from '$lib/shared-practice/types';

export const MAX_SHARED_QUIZ_ITEMS = 50;
export const SHARED_QUIZ_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const SLUG_ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz';
const SLUG_PATTERN = /^[a-z2-9]{10,12}$/;

type SharedSetRow = typeof sharedPracticeSets.$inferSelect;

export type SharedQuizResolveResult =
	| { status: 'ready'; quiz: SharedQuizView }
	| { status: 'missing' | 'expired' | 'revoked' | 'unavailable' };

export class SharedQuizValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SharedQuizValidationError';
	}
}

function makeSlug(): string {
	const bytes = randomBytes(12);
	return Array.from(bytes, (byte) => SLUG_ALPHABET[byte % SLUG_ALPHABET.length]).join('');
}

function normalizeSlug(slug: string): string {
	return slug.trim().toLowerCase();
}

function buildTitle(apClass: string, unit: string, itemCount: number): string {
	const unitPart = unit && unit !== 'All Units' ? ` ${unit}` : '';
	return `${apClass}${unitPart} — ${itemCount} Questions`;
}

function toGeneratedQuestion(question: StoredQuestion): GeneratedQuestion {
	return {
		questionId: question.id,
		topic: question.topicsCovered || undefined,
		prompt: question.question,
		options: [
			{ id: 'A', label: 'A', text: question.optionA },
			{ id: 'B', label: 'B', text: question.optionB },
			{ id: 'C', label: 'C', text: question.optionC },
			{ id: 'D', label: 'D', text: question.optionD }
		],
		correctAnswer: question.correctAnswer,
		explanation: question.explanation,
		hint1: question.hint1,
		hint2: question.hint2,
		diagramSpec: question.diagramSpec,
		hasDiagram: question.hasDiagram,
		hasStimulus: false
	};
}

function toQuizView(
	set: SharedSetRow,
	creatorName: string | null,
	items: Array<{ position: number; questionId: string }>,
	questions: Map<string, StoredQuestion>
): SharedQuizView | null {
	const resolvedQuestions = items.map((item) => questions.get(item.questionId));
	if (resolvedQuestions.some((question) => !question)) return null;

	return {
		id: set.id,
		slug: set.slug,
		title: set.title,
		kind: 'quiz',
		apClass: set.apClass,
		unit: set.unit,
		itemCount: set.itemCount,
		creatorName: creatorName?.trim() || null,
		expiresAt: set.expiresAt.toISOString(),
		questions: resolvedQuestions.map((question) => toGeneratedQuestion(question!))
	};
}

async function findSet(slug: string): Promise<SharedSetRow | null> {
	const normalized = normalizeSlug(slug);
	if (!SLUG_PATTERN.test(normalized)) return null;
	const [set] = await getNeonDatabase()
		.select()
		.from(sharedPracticeSets)
		.where(eq(sharedPracticeSets.slug, normalized))
		.limit(1);
	return set ?? null;
}

export async function createSharedQuiz(input: {
	questionIds: string[];
	unit?: string;
	creatorUserId?: string;
	organizationId?: string;
}): Promise<{ id: string; slug: string; title: string; expiresAt: string }> {
	const questionIds = input.questionIds.map((id) => id.trim()).filter(Boolean);
	if (
		questionIds.length < 1 ||
		questionIds.length > MAX_SHARED_QUIZ_ITEMS ||
		new Set(questionIds).size !== questionIds.length
	) {
		throw new SharedQuizValidationError('A shared quiz must contain 1–50 unique questions.');
	}

	const questionMap = await getQuestionsLookupMap(questionIds);
	if (questionIds.some((id) => !questionMap.has(id))) {
		throw new SharedQuizValidationError('One or more quiz questions are no longer available.');
	}

	const firstQuestion = questionMap.get(questionIds[0]!)!;
	const apClass = firstQuestion.apClass?.trim() ?? '';
	if (!apClass)
		throw new SharedQuizValidationError('A shared quiz question is missing its AP class.');
	const unit = input.unit?.trim() || 'All Units';
	if (questionIds.some((id) => (questionMap.get(id)!.apClass?.trim() ?? '') !== apClass)) {
		throw new SharedQuizValidationError('A shared quiz must contain questions from one AP class.');
	}
	if (unit.length > 120) throw new SharedQuizValidationError('Quiz unit is too long.');

	const db = getNeonDatabase();
	const expiresAt = new Date(Date.now() + SHARED_QUIZ_TTL_MS);
	const title = buildTitle(apClass, unit, questionIds.length);

	for (let attempt = 0; attempt < 3; attempt += 1) {
		const id = randomUUID();
		const slug = makeSlug();
		const result = await db.execute<{ id: string; slug: string }>(sql`
			WITH inserted_set AS (
				INSERT INTO "app"."shared_practice_sets" (
					"id", "slug", "kind", "creator_user_id", "organization_id", "title", "ap_class", "unit",
					"item_count", "status", "expires_at"
				)
				VALUES (
					${id}, ${slug}, 'quiz', ${input.creatorUserId ?? null}, ${input.organizationId ?? null}, ${title}, ${apClass}, ${unit},
					${questionIds.length}::integer, 'active', ${expiresAt}::timestamptz
				)
				ON CONFLICT ("slug") DO NOTHING
				RETURNING "id", "slug"
			), inserted_items AS (
				INSERT INTO "app"."shared_practice_set_items" (
					"shared_practice_set_id", "position", "item_type", "question_id", "question_content_hash"
				)
				SELECT inserted_set.id, items.position, 'mcq', items.question_id, items.question_content_hash
				FROM inserted_set
				CROSS JOIN (VALUES ${sql.join(
					questionIds.map(
						(questionId, position) =>
							sql`(${position}::integer, ${questionId}::text, ${questionMap.get(questionId)!.contentHash ?? null}::text)`
					),
					sql`, `
				)}) AS items(position, question_id, question_content_hash)
				RETURNING "shared_practice_set_id"
			)
			SELECT inserted_set.id, inserted_set.slug
			FROM inserted_set
			WHERE EXISTS (SELECT 1 FROM inserted_items)
		`);
		if (!result.rows[0]) continue;

		return { id, slug, title, expiresAt: expiresAt.toISOString() };
	}

	throw new Error('Could not create a share link.');
}

export async function resolveSharedQuiz(slug: string): Promise<SharedQuizResolveResult> {
	const set = await findSet(slug);
	if (!set) return { status: 'missing' };
	if (set.status === 'revoked') return { status: 'revoked' };
	if (set.status !== 'active') return { status: 'unavailable' };
	if (set.expiresAt.getTime() <= Date.now()) return { status: 'expired' };

	const [items, creator] = await Promise.all([
		getNeonDatabase()
			.select({
				position: sharedPracticeSetItems.position,
				questionId: sharedPracticeSetItems.questionId
			})
			.from(sharedPracticeSetItems)
			.where(eq(sharedPracticeSetItems.sharedPracticeSetId, set.id))
			.orderBy(asc(sharedPracticeSetItems.position)),
		set.creatorUserId
			? getNeonDatabase()
					.select({ name: authUsers.name })
					.from(authUsers)
					.where(eq(authUsers.id, set.creatorUserId))
					.limit(1)
			: Promise.resolve([])
	]);

	if (items.length !== set.itemCount) return { status: 'unavailable' };
	const questionMap = await getQuestionsLookupMap(items.map((item) => item.questionId));
	const quiz = toQuizView(set, creator[0]?.name ?? null, items, questionMap);
	return quiz ? { status: 'ready', quiz } : { status: 'unavailable' };
}

async function getSharedSetById(setId: string): Promise<SharedSetRow | null> {
	const [set] = await getNeonDatabase()
		.select()
		.from(sharedPracticeSets)
		.where(eq(sharedPracticeSets.id, setId))
		.limit(1);
	return set ?? null;
}

async function assertCanManageOrganizationSharedSet(
	userId: string,
	organizationId: string
): Promise<void> {
	await assertCanAttachSharedSetToOrganization(userId, organizationId);
}

export async function attachSharedQuizToOrganization(input: {
	setId: string;
	organizationId: string;
	userId: string;
}): Promise<void> {
	await assertCanManageOrganizationSharedSet(input.userId, input.organizationId);
	const set = await getSharedSetById(input.setId);
	if (!set || set.status !== 'active' || set.expiresAt.getTime() <= Date.now()) {
		throw new SharedQuizValidationError('This shared quiz is no longer available.');
	}
	if (set.organizationId && set.organizationId !== input.organizationId) {
		throw new OrganizationPermissionError('This quiz is already shared with another group.');
	}
	if (set.organizationId === input.organizationId) return;

	await getNeonDatabase()
		.update(sharedPracticeSets)
		.set({ organizationId: input.organizationId, updatedAt: new Date() })
		.where(
			and(
				eq(sharedPracticeSets.id, input.setId),
				eq(sharedPracticeSets.status, 'active'),
				isNull(sharedPracticeSets.organizationId)
			)
		);
}

export async function detachSharedQuizFromOrganization(input: {
	setId: string;
	organizationId: string;
	userId: string;
}): Promise<void> {
	await assertCanManageOrganizationSharedSet(input.userId, input.organizationId);
	const set = await getSharedSetById(input.setId);
	if (!set || set.organizationId !== input.organizationId) {
		throw new SharedQuizValidationError('This quiz is not shared with your group.');
	}

	await getNeonDatabase()
		.update(sharedPracticeSets)
		.set({ organizationId: null, updatedAt: new Date() })
		.where(
			and(
				eq(sharedPracticeSets.id, input.setId),
				eq(sharedPracticeSets.organizationId, input.organizationId)
			)
		);
}

export async function getSharedQuizForCompletion(slug: string): Promise<
	| {
			status: 'ready';
			id: string;
			apClass: string;
			unit: string;
			questionIds: string[];
	  }
	| { status: 'missing' | 'expired' | 'revoked' | 'unavailable' }
> {
	const result = await resolveSharedQuiz(slug);
	if (result.status !== 'ready') return result;
	return {
		status: 'ready',
		id: result.quiz.id,
		apClass: result.quiz.apClass,
		unit: result.quiz.unit,
		questionIds: result.quiz.questions.map((question) => question.questionId!).filter(Boolean)
	};
}
