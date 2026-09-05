/**
 * Generate independent MCQs and render their Examfig diagrams into a local HTML gallery.
 * This never reads from or writes to the question pool.
 *
 *   bun run questions:preview -- --class "AP Biology" --unit "Unit 1" --count 5
 */

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isStimulusQuestionsEnabled } from '../src/lib/flags';
import { renderExamfigDiagram } from '../src/lib/diagrams/examfig';
import {
	generateAPQuestion,
	type GenerateResult
} from '../src/lib/question-bank/mcq/generation.server';

function argValue(flag: string): string | undefined {
	const eq = process.argv.find((arg) => arg.startsWith(`${flag}=`));
	if (eq) return eq.slice(flag.length + 1);
	const index = process.argv.indexOf(flag);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function argInt(flag: string, fallback: number): number {
	const raw = argValue(flag);
	const value = Number.parseInt(raw ?? '', 10);
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function escapeHtml(value: unknown): string {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function renderQuestionCard(result: GenerateResult, index: number): string {
	const answer = result.answer;
	const rendered = answer.diagram ? renderExamfigDiagram(answer.diagram) : null;
	const diagramMarkup =
		rendered?.valid === true
			? `<div class="diagram">${rendered.svg}</div>`
			: rendered && !rendered.valid
				? `<div class="diagram-error"><strong>Diagram render failed:</strong> ${escapeHtml(rendered.errors.join('; '))}</div>`
				: '<div class="no-diagram">No diagram generated for this question.</div>';
	const warnings =
		rendered?.valid === true && rendered.warnings.length > 0
			? `<p class="warning">Renderer warnings: ${escapeHtml(rendered.warnings.join('; '))}</p>`
			: '';

	return `
<article class="question">
  <div class="question-header">
    <span>Question ${index + 1}</span>
    <span>${escapeHtml(answer.diagram ? `diagram: ${String(answer.diagram.type ?? 'unknown')}` : 'no diagram')}</span>
  </div>
  <h2>${escapeHtml(answer.question)}</h2>
  ${diagramMarkup}
  ${warnings}
  <ol class="options" type="A">
    <li>${escapeHtml(answer.optionA)}</li>
    <li>${escapeHtml(answer.optionB)}</li>
    <li>${escapeHtml(answer.optionC)}</li>
    <li>${escapeHtml(answer.optionD)}</li>
  </ol>
  <details>
    <summary>Answer and semantic DiagramSpec</summary>
    <p><strong>Correct answer:</strong> ${escapeHtml(answer.correctAnswer)}</p>
    <pre>${escapeHtml(JSON.stringify(answer.diagram, null, 2))}</pre>
  </details>
</article>`;
}

function buildHtml(
	className: string,
	unit: string | undefined,
	generated: GenerateResult[],
	failed: string[],
	flagEnabled: boolean
): string {
	const cards = generated.map(renderQuestionCard).join('\n');
	const failures = failed.length
		? `<section class="failures"><h2>Generation failures</h2><ul>${failed.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul></section>`
		: '';

	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Question preview — ${escapeHtml(className)}</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, sans-serif; background: #f4f4f5; color: #18181b; }
    body { max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }
    header { margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: 1.7rem; }
    h2 { white-space: pre-wrap; font-size: 1.1rem; line-height: 1.55; }
    .meta { color: #52525b; }
    .flag { color: ${flagEnabled ? '#166534' : '#991b1b'}; font-weight: 700; }
    .question { margin: 20px 0; padding: 22px; border: 1px solid #d4d4d8; border-radius: 14px; background: white; box-shadow: 0 2px 8px #0000000b; }
    .question-header { display: flex; justify-content: space-between; gap: 16px; color: #71717a; font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; }
    .diagram { margin: 20px auto; max-width: 760px; overflow-x: auto; border: 1px solid #e4e4e7; border-radius: 10px; padding: 12px; background: #fff; }
    .diagram svg { display: block; width: 100%; height: auto; }
    .no-diagram, .diagram-error, .warning { padding: 12px; border-radius: 8px; background: #fafafa; color: #52525b; }
    .diagram-error { background: #fef2f2; color: #991b1b; }
    .warning { background: #fffbeb; color: #92400e; }
    .options { padding-left: 28px; line-height: 1.7; white-space: pre-wrap; }
    details { margin-top: 18px; border-top: 1px solid #e4e4e7; padding-top: 12px; }
    pre { overflow-x: auto; padding: 12px; border-radius: 8px; background: #18181b; color: #f4f4f5; }
    .failures { padding: 16px; border: 1px solid #fecaca; border-radius: 12px; background: #fef2f2; color: #991b1b; }
  </style>
</head>
<body>
  <header>
    <h1>Independent question preview</h1>
    <div class="meta">${escapeHtml(className)}${unit ? ` · ${escapeHtml(unit)}` : ''}</div>
    <div class="meta">Generated ${generated.length} question(s) without writing to the database.</div>
    <div class="flag">stimulus-questions flag: ${flagEnabled ? 'ON' : 'OFF'}</div>
  </header>
  ${failures}
  ${cards}
</body>
</html>`;
}

async function main() {
	if (process.argv.includes('--help') || process.argv.includes('-h')) {
		console.log(
			'Usage: bun run questions:preview -- --class "AP Biology" [--unit "Unit 1"] [--count 5] [--output tmp/question-previews/run]'
		);
		return;
	}
	const className = argValue('--class');
	const unit = argValue('--unit');
	const count = Math.min(argInt('--count', 5), 50);
	const outputArg = argValue('--output');

	if (!className) {
		console.error(
			'Usage: bun run questions:preview -- --class "AP Biology" [--unit "Unit 1"] [--count 5] [--output tmp/question-previews/run]'
		);
		process.exit(1);
	}
	if (!process.env.OPEN_AI_KEY) {
		console.error('OPEN_AI_KEY is not set');
		process.exit(1);
	}

	const flagEnabled = await isStimulusQuestionsEnabled();
	if (!flagEnabled) {
		console.warn(
			'stimulus-questions is OFF. Questions will still generate, but their diagram field will be null.'
		);
	}

	const outputDir = path.resolve(
		outputArg ??
			path.join('tmp', 'question-previews', new Date().toISOString().replaceAll(':', '-'))
	);
	await mkdir(outputDir, { recursive: true });

	const generated: GenerateResult[] = [];
	const failed: string[] = [];
	for (let index = 0; index < count; index += 1) {
		console.log(`Generating question ${index + 1}/${count}...`);
		try {
			generated.push(await generateAPQuestion({ className, unit }));
		} catch (error) {
			failed.push(error instanceof Error ? error.message : String(error));
			console.error(`Question ${index + 1} failed:`, error);
		}
	}

	await writeFile(
		path.join(outputDir, 'index.html'),
		buildHtml(className, unit, generated, failed, flagEnabled)
	);
	await writeFile(
		path.join(outputDir, 'questions.json'),
		JSON.stringify({ className, unit, generated, failed }, null, 2) + '\n'
	);
	console.log(`Preview written to ${path.join(outputDir, 'index.html')}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
