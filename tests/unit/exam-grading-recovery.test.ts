import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
	find: vi.fn(),
	reclaim: vi.fn(),
	grade: vi.fn(),
	saved: vi.fn(),
	rate: vi.fn(),
	cache: vi.fn()
}));
vi.mock('#lib/auth/route-helpers.server.js', () => ({
	withAuthedHandler: (fn: (e: unknown, user: string) => unknown) => (event: unknown) =>
		fn(event, 'user')
}));
vi.mock('#lib/grading/frq/storage.server.js', () => ({
	findFrqAttemptBySubmission: m.find,
	deleteStaleFrqGradingClaim: m.reclaim
}));
vi.mock('#lib/grading/frq/attempts.server.js', () => ({
	gradeFrqAttempt: m.grade,
	getFrqAttemptForUser: m.saved,
	FrqAttemptInProgressError: class extends Error {}
}));
vi.mock('#lib/grading/frq/rate-limit.server.js', () => ({
	limitFrqGrading: m.rate,
	frqGradeRateLimitedResponse: () => new Response(null, { status: 429 })
}));
vi.mock('#lib/question-bank/frq/gate.server.js', () => ({
	requireFrqPracticeEnabled: async () => null
}));
vi.mock('#lib/question-bank/frq/model.server.js', () => ({ getFrqQuestionById: vi.fn() }));
vi.mock('#lib/question-bank/mcq/repository.server.js', () => ({ getQuestionById: vi.fn() }));
vi.mock('#lib/server/neon/db.js', () => ({
	getNeonDatabase: () => ({
		select: () => ({
			from: () => ({
				where: () => ({
					limit: async () => [
						{
							id: 'exam',
							status: 'submitted',
							sections: [
								{
									kind: 'frq',
									items: [{ id: 'item', questionId: '12345678-1234-4234-8234-123456789012' }]
								}
							],
							responses: { item: JSON.stringify({ essay: 'Answer' }) },
							grading: {}
						}
					]
				})
			})
		}),
		update: () => ({
			set: (value: unknown) => {
				m.cache(value);
				return { where: async () => undefined };
			}
		})
	})
}));
import { POST } from '../../src/routes/api/me/exam-attempts/[id]/results/+server';
const event = () =>
	({
		params: { id: 'exam' },
		request: new Request('http://localhost', {
			method: 'POST',
			body: JSON.stringify({ itemId: 'item' })
		})
	}) as never;
beforeEach(() => {
	vi.clearAllMocks();
	m.find.mockResolvedValue({ id: 'claim', status: 'grading' });
	m.reclaim.mockResolvedValue(false);
	m.rate.mockResolvedValue({ allowed: true });
	m.grade.mockResolvedValue({ grade: { pointsEarned: 1 } });
});
it('keeps live grading claims and does not launch duplicate grading', async () => {
	expect((await POST(event())).status).toBe(409);
	expect(m.grade).not.toHaveBeenCalled();
});
it('retries an abandoned claim with the same submission identity', async () => {
	m.reclaim.mockResolvedValue(true);
	expect((await POST(event())).status).toBe(200);
	const id = m.grade.mock.calls[0][1].submissionId;
	await POST(event());
	expect(m.grade.mock.calls[1][1].submissionId).toBe(id);
	expect(m.cache).toHaveBeenCalledTimes(2);
});
it('recovers completed grading without consuming rate limits or grading again', async () => {
	m.find.mockResolvedValue({ id: 'claim', status: 'graded' });
	m.saved.mockResolvedValue({ grade: { pointsEarned: 1 } });
	expect((await POST(event())).status).toBe(200);
	expect(m.rate).not.toHaveBeenCalled();
	expect(m.grade).not.toHaveBeenCalled();
});
