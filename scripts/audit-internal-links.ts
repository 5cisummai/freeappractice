/**
 * Audits internal linking coverage for public routes and practice pages.
 * Run: bun run audit:internal-links
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type PracticePage = {
	slug: string;
	type: 'class' | 'unit' | 'topic';
	className: string;
};

function walk(dir: string, files: string[] = []): string[] {
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, ent.name);
		if (ent.isDirectory()) {
			if (ent.name === 'node_modules' || ent.name === '.git') continue;
			walk(fullPath, files);
		} else if (/\.(svelte|ts|js|md|json)$/.test(ent.name)) {
			files.push(fullPath);
		}
	}
	return files;
}

function collectLinkedPaths(): Set<string> {
	const linked = new Set<string>();
	const files = walk(path.join(rootDir, 'src')).concat(
		walk(path.join(rootDir, 'static')).filter((f) => f.endsWith('.txt'))
	);

	const patterns = [
		/resolve\(\s*[`'"](\/[^`'"]+)[`'"]/g,
		/href=\{resolve\(\s*[`'"](\/[^`'"]+)[`'"]/g,
		/href=["'](\/[^"'#?]+)["']/g,
		/goto\(\s*[`'"](\/[^`'"]+)[`'"]/g,
		/\]\((\/[^)]+)\)/g
	];

	for (const file of files) {
		const text = fs.readFileSync(file, 'utf8');
		for (const re of patterns) {
			re.lastIndex = 0;
			let match: RegExpExecArray | null;
			while ((match = re.exec(text))) {
				const href = match[1]!.split('?')[0]!.split('#')[0]!;
				if (href.startsWith('/')) linked.add(href);
			}
		}
	}

	// Dynamic practice links from class hubs are generated at runtime; mark graph edges.
	const practiceData = JSON.parse(
		fs.readFileSync(path.join(rootDir, 'src/lib/data/practice-pages.json'), 'utf8')
	) as { pages: PracticePage[] };

	for (const page of practiceData.pages) {
		if (page.type === 'class') {
			for (const child of practiceData.pages) {
				if (child.className === page.className && child.type !== 'class') {
					linked.add(`/practice/${child.slug}`);
				}
			}
		}
		for (const link of (page as PracticePage & { links?: { href: string }[] }).links ?? []) {
			if (link.href.startsWith('/')) linked.add(link.href.split('?')[0]!);
		}
	}

	linked.add('/subjects');
	return linked;
}

function main(): void {
	const practiceData = JSON.parse(
		fs.readFileSync(path.join(rootDir, 'src/lib/data/practice-pages.json'), 'utf8')
	) as { pages: PracticePage[] };

	const linked = collectLinkedPaths();
	linked.add('/');

	const coreRoutes = [
		'/',
		'/subjects',
		'/blog',
		'/summer',
		'/stats',
		'/about',
		'/changelog',
		'/privacy',
		'/terms'
	];

	const missingCore = coreRoutes.filter((route) => !linked.has(route));
	const practicePages = practiceData.pages.map((p) => `/practice/${p.slug}`);
	const classPages = practiceData.pages.filter((p) => p.type === 'class');
	const childPages = practiceData.pages.filter((p) => p.type !== 'class');
	const missingChildren = childPages
		.filter((p) => !linked.has(`/practice/${p.slug}`))
		.map((p) => `/practice/${p.slug}`);

	console.log('Internal link audit\n====================');
	console.log(`Linked paths discovered: ${linked.size}`);
	console.log(`Practice pages total: ${practicePages.length}`);
	console.log(`Class hubs: ${classPages.length}`);

	if (missingCore.length > 0) {
		console.error('\nMissing inbound links for core routes:');
		for (const route of missingCore) console.error(`  - ${route}`);
	} else {
		console.log('\nAll core public routes have inbound links.');
	}

	if (missingChildren.length > 0) {
		console.error(`\nPractice child pages without inbound links: ${missingChildren.length}`);
		for (const route of missingChildren.slice(0, 10)) console.error(`  - ${route}`);
		if (missingChildren.length > 10) {
			console.error(`  ... and ${missingChildren.length - 10} more`);
		}
		process.exitCode = 1;
	} else {
		console.log('All unit/topic practice pages have inbound links from class hubs.');
	}

	if (missingCore.length > 0) process.exitCode = 1;
}

main();
