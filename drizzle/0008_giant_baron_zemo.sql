CREATE SCHEMA "feedback_analytics";
--> statement-breakpoint
CREATE VIEW "feedback_analytics"."bug_reports" WITH (security_barrier = true) AS (SELECT id, user_id, title, description, steps, expected, severity, created_at
		FROM app.bug_reports);--> statement-breakpoint
CREATE VIEW "feedback_analytics"."feedback" WITH (security_barrier = true) AS (SELECT id, user_id, category, created_at,
		CASE WHEN message LIKE '[Coach Pip message feedback]%'
			THEN split_part(message, chr(10) || chr(10) || '---' || chr(10) || 'Included chat history:' || chr(10), 1)
			ELSE message END AS message
		FROM app.app_feedback);