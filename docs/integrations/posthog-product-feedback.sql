-- PostHog saved view: product_feedback. Source names must match feedback_prod.
-- One mapping row per application user ID prevents multiplying report counts.
WITH report_rows AS (
    SELECT
        concat('feedback:', id) AS report_id,
        'feedback' AS report_type,
        created_at,
        user_id,
        category,
        NULL AS severity,
        NULL AS title,
        message AS report_text,
        NULL AS steps,
        NULL AS expected
    FROM postgres.feedback_prod.feedback
    UNION ALL
    SELECT
        concat('bug_report:', id) AS report_id,
        'bug_report' AS report_type,
        created_at,
        user_id,
        'bug' AS category,
        severity,
        title,
        description AS report_text,
        steps,
        expected
    FROM postgres.feedback_prod.bug_reports
), user_mapping AS (
    SELECT
        d.distinct_id AS user_id,
        any(toString(p.id)) AS person_id
    FROM person_distinct_ids AS d
    INNER JOIN persons AS p ON d.person_id = p.id
    GROUP BY d.distinct_id
)
SELECT
    r.report_id,
    r.report_type,
    r.created_at,
    r.user_id,
    r.category,
    r.severity,
    r.title,
    r.report_text,
    r.steps,
    r.expected,
    nullIf(m.person_id, '') AS posthog_person_id,
    if(
        empty(m.person_id),
        NULL,
        concat('https://us.posthog.com/project/486732/persons/', m.person_id)
    ) AS person_url
FROM report_rows AS r
LEFT JOIN user_mapping AS m ON r.user_id = m.user_id
