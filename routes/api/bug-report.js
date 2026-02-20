const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const { z } = require('zod');
const logger = require('../../utils/logger');

const router = express.Router();
const REPORTS_FILE = path.join(__dirname, '..', '..', 'data', 'bug-reports.json');

const reportSchema = z.object({
    title: z.string().min(5),
    description: z.string().min(10),
    steps: z.string().optional(),
    expected: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high']).default('low'),
    email: z.email().optional(),
    metadata: z.record(z.string(), z.any()).optional()
});

async function ensureReportStorage() {
    if (!existsSync(REPORTS_FILE)) {
        await fs.writeFile(REPORTS_FILE, '[]', 'utf8');
    }
}

async function readReports() {
    await ensureReportStorage();
    const content = await fs.readFile(REPORTS_FILE, 'utf8');
    return JSON.parse(content || '[]');
}

async function writeReports(reports) {
    await fs.writeFile(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
}

router.post('/', async (req, res) => {
    try {
        const parsed = reportSchema.parse(req.body);
        const id = `BR-${Date.now()}`;
        const report = {
            id,
            status: 'open',
            createdAt: new Date().toISOString(),
            ...parsed
        };

        const records = await readReports();
        records.unshift(report);
        await writeReports(records);

        logger.info('Bug report submitted', {
            id,
            severity: parsed.severity,
            title: parsed.title,
            fromIp: req.ip
        });

        res.status(201).json({ ok: true, id });
    } catch (err) {
        logger.warn('Bug report validation failed', { message: err.message });
        if (err.errors) {
            return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
        }
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;