import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { absoluteUrl } from '$lib/server/agent-discovery/site';

export const prerender = false;

const SKILL_FILES = [
	{
		name: 'generate-ap-question',
		description: 'Generate AP practice multiple-choice questions by subject and unit.'
	},
	{
		name: 'browse-ap-subjects',
		description: 'List supported AP subjects and navigate to practice pages.'
	}
] as const;

async function skillDigest(filename: string): Promise<string> {
	const path = join(process.cwd(), 'static', '.well-known', 'agent-skills', filename, 'SKILL.md');
	const content = await readFile(path, 'utf8');
	const hash = createHash('sha256').update(content).digest('hex');
	return `sha256:${hash}`;
}

export const GET: RequestHandler = async ({ url }) => {
	const skills = await Promise.all(
		SKILL_FILES.map(async (skill) => ({
			name: skill.name,
			type: 'skill-md' as const,
			description: skill.description,
			url: absoluteUrl(`/.well-known/agent-skills/${skill.name}/SKILL.md`, url),
			digest: await skillDigest(skill.name)
		}))
	);

	return json(
		{
			$schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
			skills
		},
		{
			headers: {
				'Cache-Control': 'public, max-age=3600'
			}
		}
	);
};
