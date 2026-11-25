import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	closeEveTurn,
	getEveTurn,
	isEveServiceRequest,
	openEveTurn
} from '#lib/agent/eve-turn.server.js';

const cache = vi.hoisted(() => new Map<string, string>());
vi.mock('#lib/redis/server.js', () => ({
	redisNamespace: () => 'test',
	withRedisTimeout: (operation: unknown) => operation,
	getRedisClient: () => ({
		set: async (key: string, value: string) => {
			cache.set(key, value);
			return 'OK';
		},
		get: async (key: string) => cache.get(key) ?? null,
		del: async (key: string) => cache.delete(key)
	})
}));

const localSecret = 'test-service-secret-for-unit-tests-only';
const initialClaims = {
	sub: 'student-one',
	sessionId: randomUUID(),
	conversationId: randomUUID(),
	accessReason: 'subscription',
	context: { surface: 'coach', page: 'coach' },
	scopes: ['read_profile']
} as const;

beforeEach(() => {
	cache.clear();
	vi.stubEnv('COACH_EVE_SERVICE_SECRET', localSecret);
	vi.stubEnv('COACH_EVE_TURN_SECRET', 'test-turn-signing-secret-for-unit-tests-only');
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

function openTurn() {
	return openEveTurn({ ...initialClaims, scopes: [...initialClaims.scopes] });
}

describe('Coach Eve tool credentials', () => {
	it('requires the service credential before reading a turn', () => {
		const url = 'https://app.test/api/coach-tools/v1/read_profile';
		expect(isEveServiceRequest(new Request(url))).toBe(false);
		expect(
			isEveServiceRequest(new Request(url, { headers: { authorization: `Bearer ${localSecret}` } }))
		).toBe(true);
	});

	it('binds a grant to its turn, student, conversation, and scopes', async () => {
		const turnId = await openTurn();
		const [token] = cache.values();
		const differentTurn = randomUUID();
		cache.set(`test:coach:eve:v1:${differentTurn}`, token);
		expect(await getEveTurn(turnId)).toMatchObject(initialClaims);
		expect(await getEveTurn(differentTurn)).toBeNull();
		await closeEveTurn(turnId);
		expect(await getEveTurn(turnId)).toBeNull();
	});

	it('rejects an expired grant independently of cache TTL', async () => {
		vi.useFakeTimers();
		const turnId = await openTurn();
		vi.setSystemTime(Date.now() + 121_000);
		expect(await getEveTurn(turnId)).toBeNull();
	});
});
