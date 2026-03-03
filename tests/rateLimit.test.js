process.env.NODE_ENV = 'test';
// configure a very low rate limit so tests can trigger it quickly
// use a slightly larger window to avoid timing out when the first request is slow
process.env.API_RATE_LIMIT_MAX = '2';
process.env.API_RATE_LIMIT_WINDOW_MS = '2000';

const request = require('supertest');
const app = require('../server');

describe('Global API rate limiting', () => {
    it('allows a few requests and then blocks', async () => {
        // make two successful requests (limit is 2)
        await request(app).get('/api/question/cache/stats').expect(200);
        await request(app).get('/api/question/cache/stats').expect(200);

        // third request should be rate limited
        const res = await request(app).get('/api/question/cache/stats');
        expect(res.status).toBe(429);
        expect(res.body).toHaveProperty('error');
        expect(res.headers['retry-after']).toBeDefined();
    });
});
