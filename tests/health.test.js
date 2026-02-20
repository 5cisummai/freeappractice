process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../server');

describe('Health check', () => {
    it('returns ok status with timestamp', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body).toHaveProperty('timestamp');
    });
});
