import { sql } from 'drizzle-orm';
import { pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

export const feedbackAnalyticsSchema = pgSchema('feedback_analytics');

// Owner-executed views intentionally let the importer read approved columns
// without granting it access to application tables. They must remain read-only.
export const feedbackAnalyticsReports = feedbackAnalyticsSchema
	.view('feedback', {
		id: text('id').notNull(),
		userId: text('user_id'),
		category: text('category').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
		message: text('message').notNull()
	})
	.with({ securityBarrier: true }).as(sql`SELECT id, user_id, category, created_at,
		CASE WHEN message LIKE '[Coach Pip message feedback]%'
			THEN split_part(message, chr(10) || chr(10) || '---' || chr(10) || 'Included chat history:' || chr(10), 1)
			ELSE message END AS message
		FROM app.app_feedback`);

export const feedbackAnalyticsBugReports = feedbackAnalyticsSchema
	.view('bug_reports', {
		id: text('id').notNull(),
		userId: text('user_id'),
		title: text('title').notNull(),
		description: text('description').notNull(),
		steps: text('steps'),
		expected: text('expected'),
		severity: text('severity').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
	})
	.with({ securityBarrier: true })
	.as(sql`SELECT id, user_id, title, description, steps, expected, severity, created_at
		FROM app.bug_reports`);
