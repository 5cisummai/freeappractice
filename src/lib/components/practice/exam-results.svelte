<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { FRQ_ESSAY_RESPONSE_ID } from '#lib/question-bank/frq/types.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import RichText from '#lib/components/content/rich-text.svelte';
	import QuestionCard from '#lib/components/questions/question-card.svelte';
	import { quizQuestionCardModel } from '#lib/question-bank/question-card-model.js';
	import {
		AP_SCORE_BANDS,
		BIOLOGY_SCORE_REFERENCE,
		estimateBiologyScore
	} from '#lib/exams/score-estimate.js';
	import type { ExamResults } from '#lib/users/exam-results.server.js';

	let {
		course,
		results,
		busy,
		error,
		onGrade
	}: {
		course: string;
		results: ExamResults;
		busy: boolean;
		error: string;
		onGrade: (id: string) => void;
	} = $props();

	type Filter = 'needs-review' | 'all';
	const scoreBandColors = [
		'bg-red-500',
		'bg-orange-500',
		'bg-amber-400',
		'bg-lime-500',
		'bg-green-600'
	];

	let filter = $state<Filter>('needs-review');
	let section = $state('mcq');
	let selectedId = $state('');
	let selectedFrqId = $state('');
	const mcq = $derived(
		results.sections.flatMap((section) => (section.kind === 'mcq' ? section.items : []))
	);
	const frq = $derived(
		results.sections.flatMap((section) => (section.kind === 'frq' ? section.items : []))
	);
	const correct = $derived(mcq.filter((item) => item.correct).length);
	const graded = $derived(frq.flatMap((item) => (item.result ? [item.result] : [])));
	const earned = $derived(graded.reduce((sum, grade) => sum + grade.pointsEarned, 0));
	const available = $derived(graded.reduce((sum, grade) => sum + grade.pointsAvailable, 0));
	const showScoreEstimate = $derived(course === 'AP Biology' && mcq.length > 0 && frq.length > 0);
	const estimatedScore = $derived(
		showScoreEstimate && graded.length === frq.length
			? estimateBiologyScore({
					mcqCorrect: correct,
					mcqTotal: mcq.length,
					frqEarned: earned,
					frqAvailable: available
				})
			: null
	);

	const visible = $derived(
		mcq
			.map((item, index) => ({ ...item, number: index + 1 }))
			.filter((item) => filter === 'all' || !item.correct)
	);
	const active = $derived(visible.find((item) => item.id === selectedId) ?? visible[0]);
	const activeFrq = $derived(frq.find((item) => item.id === selectedFrqId) ?? frq[0]);
	const mcqOptions = $derived(
		visible.map((item) => ({
			id: item.id,
			label: `Question ${item.number} · ${item.correct ? 'Correct' : item.selected ? 'Incorrect' : 'Unanswered'}`
		}))
	);
	const frqOptions = $derived(frq.map((item, i) => ({ id: item.id, label: `Question ${i + 1}` })));
	const practiceUrl = $derived(resolve('app/practice') + '?' + new URLSearchParams({ course }));
</script>

<svelte:head>
	<title>{course} exam results | Free AP Practice</title>
</svelte:head>

{#snippet questionNavigation(
	options: { id: string; label: string }[],
	id: string,
	onSelect: (id: string) => void
)}
	{@const index = options.findIndex((item) => item.id === id)}
	{@const previous = options[index - 1]}
	{@const next = options[index + 1]}
	<div class="flex max-w-full flex-wrap items-center gap-2">
		<Button
			size="sm"
			variant="outline"
			disabled={!previous}
			onclick={() => previous && onSelect(previous.id)}>Previous</Button
		>
		<Select.Root type="single" value={id} onValueChange={onSelect}>
			<Select.Trigger aria-label="Review question" class="max-w-full">
				{options[index]?.label}
			</Select.Trigger>
			<Select.Content>
				<Select.Group>
					{#each options as item (item.id)}
						<Select.Item value={item.id} label={item.label}>{item.label}</Select.Item>
					{/each}
				</Select.Group>
			</Select.Content>
		</Select.Root>
		<Button size="sm" variant="outline" disabled={!next} onclick={() => next && onSelect(next.id)}
			>Next</Button
		>
	</div>
{/snippet}

<div class="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
	<header class="space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h1 class="font-display text-3xl font-medium tracking-tight">{course} results</h1>
			<Button href={practiceUrl} variant="outline">Back to practice</Button>
		</div>
		{#if showScoreEstimate}
			<section class="flex flex-col gap-2 py-2" aria-labelledby="estimated-score-title">
				<div class="flex flex-wrap items-baseline justify-between gap-x-3">
					<h2 id="estimated-score-title" class="text-sm font-medium">
						Estimated AP score{#if estimatedScore !== null}<sup
								><a
									href="#score-estimate-note"
									aria-label="About this estimate"
									class="ml-0.5 text-muted-foreground hover:underline">*</a
								></sup
							>{/if}
					</h2>
				</div>
				{#if estimatedScore !== null}
					<p class="sr-only" aria-live="polite">Estimated score: {estimatedScore} out of 5</p>
					<div class="grid grid-cols-5 gap-2" aria-hidden="true">
						{#each AP_SCORE_BANDS as band (band)}
							<div class="flex flex-col gap-1 text-center">
								<div class="h-2 overflow-hidden rounded-full bg-muted">
									{#if band <= estimatedScore}
										<div
											class={[
												'h-full origin-left rounded-full motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:scale-x-0',
												scoreBandColors[band - 1]
											]}
											style:transition-delay={`${(band - 1) * 145}ms`}
										></div>
									{/if}
								</div>
								<span
									class={[
										'text-xs tabular-nums',
										band === estimatedScore
											? 'font-semibold text-foreground'
											: 'text-muted-foreground'
									]}>{band}</span
								>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-muted-foreground" aria-live="polite">
						{graded.length < frq.length
							? 'Available after free responses are graded.'
							: 'Estimate unavailable.'}
					</p>
				{/if}
			</section>
		{/if}
		<dl class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
			<div class="flex items-baseline gap-2">
				<dt class="text-muted-foreground">Multiple choice</dt>
				<dd class="font-medium tabular-nums">{correct}/{mcq.length} correct</dd>
			</div>
			{#if frq.length}
				<div class="flex items-baseline gap-2">
					<dt class="text-muted-foreground">Free response</dt>
					<dd class="font-medium tabular-nums">
						{#if graded.length}{earned}/{available} points{/if}
						{#if graded.length < frq.length}
							<span class="text-muted-foreground">{graded.length} of {frq.length} graded</span>
						{/if}
					</dd>
				</div>
			{/if}
		</dl>
	</header>

	{#if error}<p
			role="alert"
			class="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
		>
			{error}
		</p>{/if}

	<section id="mcq-review" class="min-w-0 scroll-mt-4" aria-labelledby="exam-review-title">
		<h2 id="exam-review-title" class="mb-3 text-lg font-semibold tracking-tight">Exam review</h2>
		<Tabs.Root bind:value={section}>
			<Tabs.List aria-label="Exam sections">
				<Tabs.Trigger value="mcq">Multiple choice</Tabs.Trigger>
				{#if frq.length}<Tabs.Trigger value="frq">Free response</Tabs.Trigger>{/if}
			</Tabs.List>

			<Tabs.Content value="mcq" class="mt-3 flex flex-col gap-3">
				<div class="flex flex-wrap items-center justify-between gap-3">
					{#if active}
						{@render questionNavigation(mcqOptions, active.id, (id) => (selectedId = id))}
					{/if}
					<div class="flex gap-1 rounded-lg bg-muted p-1" aria-label="Question filters">
						{#each [['needs-review', 'Needs review'], ['all', 'All questions']] as const as [value, label] (value)}
							<Button
								size="sm"
								variant={filter === value ? 'outline' : 'ghost'}
								aria-pressed={filter === value}
								onclick={() => (filter = value)}>{label}</Button
							>
						{/each}
					</div>
				</div>
				{#if active}
					{@const next = visible[visible.findIndex((item) => item.id === active.id) + 1]}
					{@const correctOption = active.question.options.find(
						(option) => option.id === active.question.correctAnswer
					)}
					{#key active.id}
						<QuestionCard
							model={quizQuestionCardModel({
								selectedCourse: course,
								selectedUnit: active.unit ?? '',
								question: active.question,
								questionNumber: String(active.number),
								answer: {
									questionNumber: String(active.number),
									selectedAnswer: active.selected ?? '',
									correctAnswer: active.question.correctAnswer ?? '',
									isCorrect: active.correct,
									timeTakenMs: 0
								}
							})}
							tutorMode="hidden"
							showUtilityActions={false}
							fitTwoColumnContent
							nextDisabled={!next}
							onQuizNext={() => next && (selectedId = next.id)}
						/>
					{/key}
					{#if correctOption || active.question.explanation}
						<div class="flex flex-col gap-1 text-sm">
							{#if correctOption}
								<p class="font-medium">Correct answer: {correctOption.label}</p>
							{/if}
							{#if active.question.explanation}
								<RichText text={active.question.explanation} blocks class="text-muted-foreground" />
							{/if}
						</div>
					{/if}
				{:else}
					<p class="mt-5 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
						No missed questions in this view.
					</p>
				{/if}
			</Tabs.Content>

			{#if activeFrq}
				{@const question = activeFrq.question}
				{@const result = activeFrq.result}
				<Tabs.Content value="frq" class="mt-3 flex flex-col gap-3">
					{@render questionNavigation(frqOptions, activeFrq.id, (id) => (selectedFrqId = id))}
					<Card.Root size="sm">
						<Card.Header class="flex flex-wrap items-center justify-between gap-2">
							<Card.Title>
								Question {frq.findIndex((item) => item.id === activeFrq.id) + 1}
							</Card.Title>
							{#if result}
								<span class="text-sm font-medium tabular-nums"
									>{result.pointsEarned}/{result.pointsAvailable} points</span
								>
							{:else}
								<Button
									size="sm"
									variant="outline"
									disabled={busy}
									onclick={() => activeFrq && onGrade(activeFrq.id)}
								>
									{busy ? 'Grading…' : 'Grade response'}
								</Button>
							{/if}
						</Card.Header>
						<Card.Content class="flex flex-col gap-4">
							{#if question}
								{#each question.materials as material (material.id)}
									<div class="rounded-lg bg-muted p-3">
										{#if material.title}<h3 class="mb-2 font-medium">{material.title}</h3>{/if}
										<RichText text={material.content} blocks />
									</div>
								{/each}
								<RichText text={question.prompt} blocks />
								{#if question.responseMode === 'essay'}
									<div class="rounded-lg bg-muted p-3">
										<p class="mb-1 font-medium">Your response</p>
										<p class="wrap-anywhere whitespace-pre-wrap text-muted-foreground">
											{activeFrq.responses[FRQ_ESSAY_RESPONSE_ID]?.trim() || 'Unanswered'}
										</p>
									</div>
								{/if}
								{#each question.parts as part (part.id)}
									{@const grade = result?.parts?.find((item) => item.id === part.id)}
									<div class="flex flex-col gap-2 border-t border-border pt-3">
										<h3 class="font-medium">
											{part.label}{#if grade}
												· {grade.points}/{grade.pointsAvailable} points{/if}
										</h3>
										<RichText text={part.prompt} blocks />
										{#if question.responseMode === 'parts'}
											<p class="wrap-anywhere whitespace-pre-wrap text-muted-foreground">
												<span class="font-medium text-foreground">Your response</span><br
												/>{activeFrq.responses[part.id]?.trim() || 'Unanswered'}
											</p>
										{/if}
										{#if grade}<RichText
												text={grade.feedback}
												blocks
												class="text-muted-foreground"
											/>{/if}
									</div>
								{/each}
							{:else}
								<p class="text-muted-foreground">The original prompt is unavailable.</p>
								{#each result?.parts ?? [] as part (part.id)}
									<div>
										<h3 class="font-medium">
											{part.label} · {part.points}/{part.pointsAvailable} points
										</h3>
										<RichText text={part.feedback} blocks class="text-muted-foreground" />
									</div>
								{/each}
							{/if}
							{#if result?.overallFeedback}
								<div class="border-t border-border pt-3">
									<h3 class="mb-1 font-medium">Overall feedback</h3>
									<RichText text={result.overallFeedback} blocks class="text-muted-foreground" />
								</div>
							{/if}
						</Card.Content>
					</Card.Root>
				</Tabs.Content>
			{/if}
		</Tabs.Root>
	</section>

	{#if estimatedScore !== null}
		<p id="score-estimate-note" class="scroll-mt-4 text-xs text-muted-foreground">
			* Practice estimate based on the
			<a
				href={BIOLOGY_SCORE_REFERENCE}
				target="_blank"
				rel="noopener noreferrer"
				class="underline underline-offset-2">2013 Biology scoring worksheet</a
			>. Cutoffs vary by exam.
		</p>
	{/if}
</div>
