import { count, desc, eq } from 'drizzle-orm';
import type { AdminFeedbackItem } from '$lib/admin/types';
import type { AppFeedbackCategory } from '$lib/schemas/app-feedback';
import type { BugReportSeverity } from '$lib/schemas/bug-report';
import { getNeonDatabase } from '$lib/server/neon/db';
import { appFeedback, authUsers, bugReports } from '$lib/server/neon/schema';

const FEEDBACK_CATEGORY_SET = new Set<string>([
	'general',
	'bug',
	'feature_request',
	'content',
	'other'
]);

const BUG_SEVERITY_SET = new Set<string>(['low', 'medium', 'high']);

function toFeedbackCategory(value: string): AppFeedbackCategory {
	if (FEEDBACK_CATEGORY_SET.has(value)) {
		return value as AppFeedbackCategory;
	}
	return 'other';
}

function toBugSeverity(value: string): BugReportSeverity {
	if (BUG_SEVERITY_SET.has(value)) {
		return value as BugReportSeverity;
	}
	return 'medium';
}

function displayEmail(userEmail?: string | null, reporterEmail?: string | null): string | null {
	return userEmail ?? reporterEmail ?? null;
}

async function listSidebarFeedbackForAdmin(limit: number): Promise<{
	items: AdminFeedbackItem[];
	total: number;
}> {
	const db = getNeonDatabase();
	const rows = await db
		.select({
			id: appFeedback.id,
			category: appFeedback.category,
			message: appFeedback.message,
			createdAt: appFeedback.createdAt,
			userId: appFeedback.userId,
			userName: authUsers.name,
			userEmail: authUsers.email
		})
		.from(appFeedback)
		.leftJoin(authUsers, eq(appFeedback.userId, authUsers.id))
		.orderBy(desc(appFeedback.createdAt))
		.limit(limit);

	const [totalRow] = await db.select({ total: count() }).from(appFeedback);

	return {
		items: rows.map((row) => ({
			id: row.id,
			source: 'sidebar',
			category: toFeedbackCategory(row.category),
			message: row.message,
			createdAt: row.createdAt,
			userId: row.userId,
			userName: row.userName,
			userEmail: row.userEmail
		})),
		total: totalRow?.total ?? 0
	};
}

async function listBugReportsForAdmin(limit: number): Promise<{
	items: AdminFeedbackItem[];
	total: number;
}> {
	const db = getNeonDatabase();
	const rows = await db
		.select({
			id: bugReports.id,
			title: bugReports.title,
			description: bugReports.description,
			steps: bugReports.steps,
			expected: bugReports.expected,
			severity: bugReports.severity,
			email: bugReports.email,
			metadata: bugReports.metadata,
			createdAt: bugReports.createdAt,
			userId: bugReports.userId,
			userName: authUsers.name,
			userEmail: authUsers.email
		})
		.from(bugReports)
		.leftJoin(authUsers, eq(bugReports.userId, authUsers.id))
		.orderBy(desc(bugReports.createdAt))
		.limit(limit);

	const [totalRow] = await db.select({ total: count() }).from(bugReports);

	return {
		items: rows.map((row) => ({
			id: row.id,
			source: 'bug_report',
			title: row.title,
			description: row.description,
			steps: row.steps,
			expected: row.expected,
			severity: toBugSeverity(row.severity),
			reporterEmail: row.email,
			metadata: row.metadata,
			createdAt: row.createdAt,
			userId: row.userId,
			userName: row.userName,
			userEmail: displayEmail(row.userEmail, row.email)
		})),
		total: totalRow?.total ?? 0
	};
}

export async function listFeedbackTabForAdmin(limit = 50): Promise<{
	items: AdminFeedbackItem[];
	totalSidebar: number;
	totalBugReports: number;
}> {
	const [sidebar, bugReportsSnapshot] = await Promise.all([
		listSidebarFeedbackForAdmin(limit),
		listBugReportsForAdmin(limit)
	]);

	const items = [...sidebar.items, ...bugReportsSnapshot.items]
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
		.slice(0, limit);

	return {
		items,
		totalSidebar: sidebar.total,
		totalBugReports: bugReportsSnapshot.total
	};
}
