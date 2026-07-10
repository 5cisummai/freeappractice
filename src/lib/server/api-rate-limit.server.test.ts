import assert from 'node:assert/strict';
import test from 'node:test';
import { enforceAiRateLimit } from './api-rate-limit';

const privateEnv = {
	UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
	UPSTASH_REDIS_REST_TOKEN: 'test-token',
	API_RATE_LIMIT_WINDOW_MS: '60000',
	API_RATE_LIMIT_MAX: '2'
};

function event(pathname: string, userId?: string) {
	return {
		url: new URL(`https://freeappractice.org${pathname}`),
		locals: { userId },
		getClientAddress: () => '203.0.113.10'
	};
}

test('allows a legitimate request and atomically keys authenticated users', async () => {
	let command: unknown;
	const response = await enforceAiRateLimit(event('/api/question', 'user-123'), {
		privateEnv,
		fetchImpl: async (_input, init) => {
			command = JSON.parse(String(init?.body));
			return Response.json({ result: [1, 60000] });
		}
	});

	assert.equal(response, null);
	assert.ok(Array.isArray(command));
	assert.equal(command[0], 'EVAL');
	assert.equal(command[2], '1');
	assert.equal(command[3], 'freeappractice:ai-rate-limit:v1:user:user-123');
	assert.equal(command[4], '60000');
});

test('rejects a shared counter over quota with the remaining window', async () => {
	const response = await enforceAiRateLimit(event('/api/tutor/chat'), {
		privateEnv,
		fetchImpl: async () => Response.json({ result: [3, 41001] })
	});

	assert.equal(response?.status, 429);
	assert.equal(response?.headers.get('Retry-After'), '42');
	assert.deepEqual(await response?.json(), { error: 'Too many requests' });
});

test('uses the adapter-provided address for anonymous identity', async () => {
	let key: unknown;
	await enforceAiRateLimit(event('/api/tutor/greeting'), {
		privateEnv,
		fetchImpl: async (_input, init) => {
			key = JSON.parse(String(init?.body))[3];
			return Response.json({ result: [1, 60000] });
		}
	});

	assert.equal(key, 'freeappractice:ai-rate-limit:v1:ip:203.0.113.10');
});

test('fails closed when shared rate-limit configuration is absent', async () => {
	const response = await enforceAiRateLimit(event('/api/question'), { privateEnv: {} });

	assert.equal(response?.status, 503);
	assert.deepEqual(await response?.json(), { error: 'Service temporarily unavailable' });
});

test('fails closed when the shared store is unavailable', async () => {
	const response = await enforceAiRateLimit(event('/api/question'), {
		privateEnv,
		fetchImpl: async () => new Response('unavailable', { status: 503 })
	});

	assert.equal(response?.status, 503);
});

test('does not contact Redis for unrelated API routes', async () => {
	let called = false;
	const response = await enforceAiRateLimit(event('/api/me/progress'), {
		privateEnv: {},
		fetchImpl: async () => {
			called = true;
			return Response.json({ result: [1, 60000] });
		}
	});

	assert.equal(response, null);
	assert.equal(called, false);
});
