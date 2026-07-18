/**
 * Manual question-quality controls against the authenticated admin API.
 *
 * Preview only:
 *   bun run quality --preview --class "AP Biology" --unit "Unit 1" --max 250
 * Preview and explicitly approve:
 *   bun run quality --preview --approve --max 500
 * Refresh/pause/resume/cancel:
 *   bun run quality --refresh <jobId>
 * Reconcile the S3 inventory (add --hydrate for class/unit metadata):
 *   bun run quality --reconcile --hydrate
 */
import 'dotenv/config';

const args = process.argv.slice(2);
const baseUrl = (
	process.env.QUESTION_QUALITY_BASE_URL ||
	process.env.PUBLIC_BASE_URL ||
	'http://localhost:5173'
).replace(/\/$/, '');
const token = process.env.QUESTION_QUALITY_ADMIN_TOKEN?.trim();
if (!token) throw new Error('QUESTION_QUALITY_ADMIN_TOKEN is required');

function valueAfter(flag: string): string | undefined {
	const index = args.indexOf(flag);
	return index >= 0 ? args[index + 1] : undefined;
}

async function request(body: Record<string, unknown>): Promise<unknown> {
	const response = await fetch(`${baseUrl}/api/admin/question-quality`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});
	const payload = await response.json();
	if (!response.ok) throw new Error(JSON.stringify(payload));
	return payload;
}

async function main() {
	if (args.includes('--reconcile')) {
		console.log(
			await request({ action: 'reconcile', hydrateMetadata: args.includes('--hydrate') })
		);
		return;
	}

	for (const action of ['refresh', 'pause', 'resume', 'cancel'] as const) {
		const jobId = valueAfter(`--${action}`);
		if (jobId) {
			console.log(await request({ action, jobId }));
			return;
		}
	}

	if (!args.includes('--preview')) {
		throw new Error('Use --preview, --reconcile, --refresh, --pause, --resume, or --cancel');
	}
	const preview = (await request({
		action: 'preview',
		filters: {
			apClass: valueAfter('--class'),
			unit: valueAfter('--unit'),
			createdAfter: valueAfter('--after'),
			createdBefore: valueAfter('--before'),
			minimumAgeDays: Number(valueAfter('--min-age') || '7'),
			maxCount: Number(valueAfter('--max') || '500')
		}
	})) as { previewId: string };
	console.log(preview);
	if (!args.includes('--approve')) {
		console.log('Preview only. Re-run with the same filters and --approve to submit a batch.');
		return;
	}
	console.log(await request({ action: 'create', previewId: preview.previewId }));
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
