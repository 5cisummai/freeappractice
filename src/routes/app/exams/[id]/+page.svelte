<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import QuizSession from '#lib/components/practice/quiz-session.svelte';
	import FrqSession from '#lib/components/practice/frq-session.svelte';
	import { requestMcqQuestionById } from '#lib/question-bank/request.client.js';
	import type { GeneratedQuestion } from '#lib/question-bank/mcq/types.js';
	import type { ExamSection } from '#lib/exams/session.js';
	import { Button } from '#lib/components/ui/button/index.js';

	type Attempt = {
		id: string;
		course: string;
		sections: ExamSection[];
		responses: Record<string, string>;
		status: string;
		revision: number;
		sectionIndex: number;
		sectionStartedAt: string | null;
	};
	type Results = {
		sections: Array<{
			id: string;
			title: string;
			kind: string;
			correct?: number;
			total?: number;
			items?: Array<{
				id: string;
				result: { pointsEarned: number; pointsAvailable: number } | null;
			}>;
		}>;
	};
	let attempt = $state<Attempt | null>(null);
	let results = $state<Results | null>(null);
	let questions = $state<GeneratedQuestion[]>([]);
	let error = $state('');
	let busy = $state(false);
	let now = $state(Date.now());
	let serverOffset = $state(0);
	let frqIndex = $state(0);
	let draft = $state<Record<string, string>>({});
	let pending: Record<string, string> = {};
	let queue: Promise<void> = Promise.resolve();
	let saveTimer: ReturnType<typeof setTimeout> | undefined;
	let clock: ReturnType<typeof setInterval> | undefined;
	let expiryTriggered = false;
	const section = $derived(attempt?.sections[attempt.sectionIndex]);
	const remaining = $derived(
		section?.timeLimitMs != null && attempt?.sectionStartedAt
			? Math.max(0, Date.parse(attempt.sectionStartedAt) + section.timeLimitMs - now - serverOffset)
			: null
	);
	const url = $derived(`/api/me/exam-attempts/${encodeURIComponent(page.params.id ?? '')}`);

	async function readAttempt() {
		const response = await fetch(url);
		const data = await response.json();
		if (!response.ok) throw new Error(data.error ?? 'Could not load exam.');
		attempt = data.attempt;
		serverOffset = Date.parse(data.serverTime) - Date.now();
		draft = { ...data.attempt.responses };
	}
	async function mutate(
		action: 'start' | 'save' | 'finish',
		responses: Record<string, string> = {}
	) {
		if (!attempt) return;
		const response = await fetch(url, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, revision: attempt.revision, responses })
		});
		const data = await response.json();
		if (!response.ok) throw new Error(data.error ?? 'Could not save exam.');
		attempt = data.attempt;
		serverOffset = Date.parse(data.serverTime) - Date.now();
	}
	function enqueue(task: () => Promise<void>) {
		queue = queue.then(task).catch((e: unknown) => {
			error = e instanceof Error ? e.message : 'Could not save exam.';
		});
		return queue;
	}
	function update(itemId: string, value: string) {
		if (busy || !attempt?.sectionStartedAt || remaining === 0) return;
		draft = { ...draft, [itemId]: value };
		pending[itemId] = value;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => void flush(), 350);
	}
	function flush() {
		clearTimeout(saveTimer);
		const changes = pending;
		pending = {};
		if (!Object.keys(changes).length) return queue;
		return enqueue(async () => {
			try {
				await mutate('save', changes);
			} catch (e) {
				pending = { ...changes, ...pending };
				throw e;
			}
		});
	}
	async function finish() {
		if (busy || !attempt?.sectionStartedAt) return;
		busy = true;
		await flush();
		if (Object.keys(pending).length && remaining !== 0) {
			busy = false;
			return;
		}
		if (remaining === 0) pending = {};
		await enqueue(async () => {
			await mutate('finish');
			frqIndex = 0;
			questions = [];
			expiryTriggered = false;
			if (attempt?.status === 'submitted') await loadResults();
		});
		busy = false;
		if (attempt?.status === 'submitted' && results) void gradePending();
	}
	async function loadQuestions() {
		if (!section || section.kind !== 'mcq') return;
		questions = (
			await Promise.all(section.items.map((item) => requestMcqQuestionById(item.questionId)))
		).map((result) => result.question);
	}
	async function start() {
		busy = true;
		error = '';
		try {
			if (section?.kind === 'mcq') await loadQuestions();
			await mutate('start');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not start section.';
		}
		busy = false;
	}
	async function loadResults() {
		const response = await fetch(`${url}/results`);
		const data = await response.json();
		if (!response.ok) throw new Error(data.error ?? 'Could not load results.');
		results = data;
	}
	async function gradePending() {
		const ids =
			results?.sections.flatMap(
				(section) => section.items?.filter((item) => !item.result).map((item) => item.id) ?? []
			) ?? [];
		for (const id of ids) {
			if (!(await grade(id))) break;
		}
	}
	async function grade(itemId: string): Promise<boolean> {
		busy = true;
		error = '';
		try {
			const response = await fetch(`${url}/results`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemId })
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error ?? 'Grading failed.');
			await loadResults();
			return true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Grading failed.';
			return false;
		} finally {
			busy = false;
		}
	}
	function parsedResponse(value: string | undefined): Record<string, string> {
		try {
			return JSON.parse(value ?? '{}');
		} catch {
			return {};
		}
	}
	onMount(() => {
		void (async () => {
			try {
				await readAttempt();
				if (attempt?.status === 'submitted') {
					await loadResults();
					void gradePending();
				} else if (attempt?.sectionStartedAt && section?.kind === 'mcq') await loadQuestions();
			} catch (e) {
				error = e instanceof Error ? e.message : 'Could not load exam.';
			}
		})();
		clock = setInterval(() => {
			now = Date.now();
			if (remaining === 0 && attempt?.sectionStartedAt && !expiryTriggered && !busy) {
				expiryTriggered = true;
				void finish();
			}
		}, 250);
	});
	onDestroy(() => {
		clearInterval(clock);
		clearTimeout(saveTimer);
		void flush();
	});
</script>

<div class="mx-auto max-w-3xl space-y-5 p-6">
	<h1 class="text-2xl font-semibold">Full-length exam</h1>
	{#if error}<p role="alert" class="text-destructive">{error}</p>{/if}
	{#if !attempt && !error}<p>Loading exam…</p>
	{:else if attempt?.status === 'submitted' && results}
		{#each results.sections as result (result.id)}
			<section class="space-y-2 rounded-lg border p-4">
				<h2 class="font-semibold">{result.title}</h2>
				{#if result.kind === 'mcq'}<p>{result.correct} / {result.total} correct</p>
				{:else if result.items}{#each result.items as item, i (item.id)}<div
							class="flex items-center justify-between gap-3"
						>
							<span
								>Question {i + 1}: {item.result
									? `${item.result.pointsEarned} / ${item.result.pointsAvailable} points`
									: 'Not graded'}</span
							>{#if !item.result}<Button disabled={busy} onclick={() => void grade(item.id)}
									>Grade response</Button
								>{/if}
						</div>{/each}{/if}
			</section>
		{/each}
	{:else if section && attempt}
		<p>
			{section.title} · {section.timeLimitMs === null
				? 'Untimed practice'
				: `${Math.ceil(section.timeLimitMs / 60000)} minutes`}
		</p>
		{#if !attempt.sectionStartedAt}<Button disabled={busy} onclick={() => void start()}
				>Start section</Button
			>
		{:else if section.kind === 'mcq' && questions.length}
			<QuizSession
				selectedCourse={attempt.course}
				selectedUnit=""
				count={questions.length}
				requestVersion={1}
				initialQuestions={questions}
				persistHistory={false}
				showCoachReview={false}
				examSection={{
					startedAtMs: Date.parse(attempt.sectionStartedAt) - serverOffset,
					timeLimitMs: section.timeLimitMs,
					selections: section.items.map((item) => draft[item.id] || null),
					onChange: (index, value) => update(section.items[index].id, value ?? ''),
					onComplete: () => void finish()
				}}
			/>
		{:else if section.kind === 'frq'}
			{#key section.items[frqIndex].id}
				<FrqSession
					selectedCourse={attempt.course}
					selectedUnit=""
					requestVersion={1}
					presetQuestionId={section.items[frqIndex].questionId}
					examSection={{
						responses: parsedResponse(draft[section.items[frqIndex].id]),
						remainingMs: remaining,
						index: frqIndex,
						count: section.items.length,
						onChange: (responses) => update(section.items[frqIndex].id, JSON.stringify(responses)),
						onNext: () => frqIndex++,
						onPrevious: () => frqIndex--,
						onGoTo: (index) => (frqIndex = index),
						onFinish: () => void finish()
					}}
				/>
			{/key}
		{:else}<p>Loading questions…</p>
			<Button onclick={() => void loadQuestions().catch((e) => (error = e.message))}
				>Retry loading</Button
			>{/if}
	{/if}
</div>
