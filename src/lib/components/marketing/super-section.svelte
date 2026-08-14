<script lang="ts">
	import CoachChatDemo from '$lib/components/marketing/coach-chat-demo.svelte';
	import SectionIntro from '$lib/components/marketing/section-intro.svelte';
	import { twAnimateInViewSubtle } from '$lib/tw-animate';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import FileTextIcon from '@lucide/svelte/icons/file-text';

	const planTasks = [
		{
			label: 'AP Biology · Unit 3',
			meta: 'Aug 11 · 20 min · MCQ',
			done: true
		},
		{
			label: 'AP Calculus AB · Unit 2',
			meta: 'Aug 12 · 25 min · MCQ',
			done: false
		},
		{
			label: 'AP Chemistry · Unit 4',
			meta: 'Aug 13 · 30 min · FRQ',
			done: false
		}
	];

	const wellClass = 'relative min-h-0 flex-1 overflow-hidden';
	const cardClass =
		'flex min-h-0 flex-col overflow-hidden rounded-3xl bg-muted/50 ring-1 ring-foreground/5 marketing-card-shadow';
	const captionClass = 'space-y-1 px-5 py-4 sm:px-6 sm:py-5';
	const mockScaleClass = 'pointer-events-none w-[118%] [zoom:0.85]';
</script>

<section id="super" class="w-full space-y-12" aria-labelledby="super-section-heading">
	<SectionIntro id="super-section-heading">
		{#snippet title()}
			Intelligent tutoring built around
			<span class="relative inline-block px-1">
				you<svg
					class="pointer-events-none absolute -bottom-1 left-0 h-3 w-full text-primary"
					viewBox="0 0 88 10"
					fill="none"
					aria-hidden="true"
				>
					<path
						d="M2 7.2c12.5-3.8 26.4 1.6 39.2-.4C54.2 5 66.8 2.1 86 6.4"
						stroke="currentColor"
						stroke-width="2.6"
						stroke-linecap="round"
					/>
				</svg>
			</span>
		{/snippet}
		{#snippet description()}
			<p>
				Coach remembers how you learn and reasons from your attempts—so you close the unit that's
				slipping, not a chatbot you brief from scratch.
			</p>
		{/snippet}
	</SectionIntro>

	<div
		class="grid min-h-[52svh] items-stretch gap-4 sm:gap-5 lg:min-h-152 lg:grid-cols-12 lg:grid-rows-2"
	>
		<article class="{cardClass} min-h-112 lg:col-span-8 lg:row-span-2 {twAnimateInViewSubtle}">
			<div class="{wellClass} bg-background" aria-hidden="true">
				<CoachChatDemo />
			</div>
		</article>

		<article class="{cardClass} min-h-72 {twAnimateInViewSubtle} lg:col-span-4">
			<div class="{wellClass} min-h-52 p-4 sm:p-5" aria-hidden="true">
				<div class={mockScaleClass}>
					<div
						class="relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10"
					>
						<div class="absolute top-2.5 right-2.5 z-10 flex gap-1">
							<span
								class="inline-flex h-7 items-center gap-1 rounded-md bg-background/85 px-2 text-[0.7rem] font-medium shadow-sm backdrop-blur-sm"
							>
								<ExternalLinkIcon class="size-3" />
								Open PDF
							</span>
							<span
								class="inline-flex h-7 items-center gap-1 rounded-md bg-background/85 px-2 text-[0.7rem] font-medium shadow-sm backdrop-blur-sm"
							>
								<DownloadIcon class="size-3" />
								Download
							</span>
						</div>
						<div class="space-y-3 px-4 pt-11 pb-4 text-neutral-900">
							<div class="flex items-center gap-2 text-neutral-500">
								<FileTextIcon class="size-3.5" />
								<p class="text-[0.65rem] font-medium tracking-wide uppercase">
									Personal assessment brief
								</p>
							</div>
							<p class="font-display text-lg font-medium tracking-tight">AP Biology</p>
							<p class="text-xs leading-5 text-neutral-600">
								Strongest: Unit 2 cell structure. Focus next: Unit 3 energetics and FRQ evidence
								phrasing.
							</p>
							<div class="grid grid-cols-2 gap-2">
								<div class="rounded-lg bg-neutral-100 px-2.5 py-1.5">
									<p class="text-[0.65rem] text-neutral-500">MCQ accuracy</p>
									<p class="text-base font-semibold">82%</p>
								</div>
								<div class="rounded-lg bg-neutral-100 px-2.5 py-1.5">
									<p class="text-[0.65rem] text-neutral-500">Units to review</p>
									<p class="text-base font-semibold">2</p>
								</div>
							</div>
						</div>
					</div>
					<p class="mt-2 text-[0.65rem] text-muted-foreground">
						Generated Aug 11, 2026 from 47 scored attempts.
					</p>
				</div>
			</div>
			<div class={captionClass}>
				<h3 class="text-base font-semibold tracking-tight">See what's actually slipping</h3>
				<p class="text-sm leading-6 text-muted-foreground">A weekly brief from your attempts.</p>
			</div>
		</article>

		<article class="{cardClass} min-h-72 {twAnimateInViewSubtle} lg:col-span-4">
			<div class="{wellClass} min-h-52 p-4 sm:p-5" aria-hidden="true">
				<div class={mockScaleClass}>
					<div
						class="overflow-hidden rounded-2xl border border-border bg-card py-4 text-sm shadow-none ring-1 ring-foreground/10"
					>
						<div class="space-y-0.5 px-4">
							<p class="text-sm leading-normal font-medium">Active weekly study plan</p>
							<p class="text-xs text-muted-foreground">Every task is capped at 30 minutes.</p>
						</div>
						<div class="mt-2 px-4">
							{#each planTasks as task (task.label)}
								<div
									class="flex min-w-0 items-center justify-between gap-2 border-b border-border py-2.5 last:border-b-0"
								>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium {task.done ? 'line-through' : ''}">
											{task.label}
										</p>
										<p class="text-[0.65rem] text-muted-foreground">{task.meta}</p>
									</div>
									<div class="flex shrink-0 gap-1.5">
										<span
											class="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium shadow-xs"
										>
											<BookOpenIcon class="size-3" />
											Practice
										</span>
										<span
											class="inline-flex h-7 items-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground {task.done
												? 'opacity-50'
												: ''}"
										>
											Complete
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
			<div class={captionClass}>
				<h3 class="text-base font-semibold tracking-tight">Finish this week</h3>
				<p class="text-sm leading-6 text-muted-foreground">30-minute tasks from those gaps.</p>
			</div>
		</article>
	</div>
</section>
