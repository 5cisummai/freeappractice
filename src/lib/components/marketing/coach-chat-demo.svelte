<script lang="ts">
	import { tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { fly } from 'svelte/transition';
	import { Shimmer } from '$lib/components/ai-elements/shimmer/index.js';
	import RichText from '$lib/components/content/rich-text.svelte';
	import { SUPER_GRADIENT_BUTTON_CLASS } from '$lib/super/ui';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SquareIcon from '@lucide/svelte/icons/square';

	type CoachDemoTool = {
		running: string;
		complete: string;
	};

	type CoachDemoScene = {
		prompt: string;
		tools: CoachDemoTool[];
		reply: string;
	};

	const SCENES: CoachDemoScene[] = [
		{
			prompt:
				"I keep missing photosynthesis even after reviewing Unit 3. Exam's in three weeks. What should I actually do this week?",
			tools: [
				{ running: 'Checking your recent practice…', complete: 'Checked your recent practice' },
				{ running: 'Reviewing your insights…', complete: 'Reviewed your insights' },
				{ running: 'Checking your study plan…', complete: 'Checked your study plan' }
			],
			reply: `Don't restudy all of Bio. Unit 3 is the leak.

You've missed **4 of your last 6** cellular energetics MCQs, and the last FRQ stalled on the light reactions — that's the same gap Insights already flagged. Unit 2 cell structure is solid. Leave it.

This week:

1. **Today, 20 min** — Light-dependent reactions MCQs only. Stop after 12. The misses will tell us if it's the thylakoid sequence or NADPH vs ATP.
2. **Saturday, 25 min** — One photosynthesis FRQ. Say the evidence sentences out loud before you type them.
3. **Monday, 20 min** — Mixed Unit 3. If light reactions are above 70%, we move to the Calvin cycle. If not, we run the same set again.

Don't add another Bio unit until this one stops leaking.`
		},
		{
			prompt:
				'I just finished my Calc AB quiz and missed 6, 9, and 11. What did I actually get wrong?',
			tools: [
				{ running: 'Reviewing your quiz…', complete: 'Reviewed your quiz' },
				{ running: 'Checking your recent practice…', complete: 'Checked your recent practice' },
				{ running: 'Checking the course catalog…', complete: 'Checked the course catalog' }
			],
			reply: `Those three misses are one habit, not three topics.

On 6, 9, and 11 you differentiated the outside of a composite function, then stopped. Chain rule is showing up as "take the outer derivative and move on." Unit 2 is otherwise fine — **11 of your last 14** derivative MCQs are correct.

Tonight, 20 min:

1. **6 chain-rule MCQs only.** If the inside is a product or a trig function, write the inside derivative on scratch paper before you pick.
2. Stop after 6. If 5 are right, you're done. If not, we run the same set tomorrow — not a new unit.

Don't restudy limits. That's not the leak.`
		},
		{
			prompt: "I have Bio, Calc, and Chem this week and I'm drowning. What do I drop?",
			tools: [
				{ running: 'Reviewing your goals…', complete: 'Reviewed your goals' },
				{ running: 'Checking your recent practice…', complete: 'Checked your recent practice' },
				{ running: 'Checking your study plan…', complete: 'Checked your study plan' }
			],
			reply: `Drop Chem tonight. Not forever — this week.

Bio Unit 3 is at **38%** with 4 misses in 6. Calc AB Unit 2 is on track. Chem Unit 4 isn't leaking; you just haven't started the FRQ. Spreading time across all three is the panic talking.

Keep two blocks:

1. **Today, 20 min** — Bio light reactions MCQs only.
2. **Thursday, 25 min** — Calc AB chain rule. That's the live miss.

Chem waits until Sunday: one 30-minute FRQ. That's enough.`
		}
	];

	let scene = $state(SCENES[0]);
	let composerText = $state('');
	let sendPressed = $state(false);
	let promptVisible = $state(false);
	let thinking = $state(false);
	let toolsVisible = $state(false);
	let toolsExpanded = $state(false);
	let runningTool = $state(-1);
	let completedTools = $state(0);
	let replyText = $state('');
	let streaming = $state(false);
	let fading = $state(false);

	const composerBusy = $derived(streaming || thinking || runningTool >= 0);
	const canSend = $derived(composerText.trim().length > 0 && !composerBusy);
	const visibleReply = $derived(closeOpenMarkdown(replyText));
	const activitySummary = $derived.by(() => {
		const tools = scene.tools;
		const active = tools[runningTool];
		if (active) return active.running;
		if (completedTools === tools.length) {
			return tools.length === 1
				? (tools[0]?.complete ?? 'Done')
				: `Completed ${tools.length} steps`;
		}
		return tools[0]?.running ?? 'Working on it…';
	});

	function closeOpenMarkdown(text: string): string {
		const markers = text.match(/\*\*/g)?.length ?? 0;
		if (markers % 2 === 0) return text;
		if (text.endsWith('**')) return text.slice(0, -2);
		return `${text}**`;
	}

	function typeDelay(char: string): number {
		if (char === '.') return 28;
		return 9;
	}

	function toTokens(text: string): string[] {
		return text.match(/\n+|[^\s\n]+[ \t]*/g) ?? [text];
	}

	function tokenDelay(token: string): number {
		if (token.includes('\n\n')) return 88;
		if (token.includes('\n')) return 36;
		if (/[.!?]\s*$/.test(token.trimEnd())) return 32;
		if (token.trim().length > 12) return 22;
		return 18;
	}

	function toolDelay(index: number): number {
		return 720 + index * 160;
	}

	const runDemo: Attachment<HTMLElement> = (node) => {
		const messagesEl = node.querySelector<HTMLElement>('[data-coach-messages]');
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		let visible = false;
		let cancelled = false;
		let timeoutId = 0;
		let settle: (() => void) | null = null;

		async function scrollToLatest(): Promise<void> {
			await tick();
			if (!messagesEl) return;
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}

		function sleep(ms: number): Promise<void> {
			return new Promise((resolve) => {
				settle = resolve;
				timeoutId = window.setTimeout(() => {
					settle = null;
					resolve();
				}, ms);
			});
		}

		async function wait(ms: number): Promise<void> {
			while (!cancelled && (document.hidden || !visible)) {
				await sleep(120);
			}
			if (cancelled || ms <= 0) return;
			await sleep(ms);
		}

		function reset() {
			composerText = '';
			sendPressed = false;
			promptVisible = false;
			thinking = false;
			toolsVisible = false;
			toolsExpanded = false;
			runningTool = -1;
			completedTools = 0;
			replyText = '';
			streaming = false;
		}

		function showFinished(next: CoachDemoScene) {
			scene = next;
			composerText = '';
			sendPressed = false;
			promptVisible = true;
			thinking = false;
			toolsVisible = true;
			toolsExpanded = false;
			runningTool = -1;
			completedTools = next.tools.length;
			replyText = next.reply;
			streaming = false;
			void scrollToLatest();
		}

		async function play(next: CoachDemoScene): Promise<void> {
			reset();
			scene = next;
			await wait(480);

			for (let i = 0; i < next.prompt.length; i += 2) {
				if (cancelled) return;
				const slice = next.prompt.slice(i, i + 2);
				composerText += slice;
				await wait(typeDelay(slice.slice(-1)));
			}

			await wait(180);
			sendPressed = true;
			await wait(90);
			sendPressed = false;
			promptVisible = true;
			composerText = '';
			await scrollToLatest();

			await wait(520);
			thinking = true;
			await wait(640);
			thinking = false;
			runningTool = 0;
			toolsVisible = true;
			toolsExpanded = true;
			await scrollToLatest();

			for (let i = 0; i < next.tools.length; i += 1) {
				if (cancelled) return;
				runningTool = i;
				await scrollToLatest();
				await wait(toolDelay(i));
				completedTools = i + 1;
				runningTool = -1;
			}

			await wait(280);
			streaming = true;
			for (const token of toTokens(next.reply)) {
				if (cancelled) return;
				replyText += token;
				await scrollToLatest();
				await wait(tokenDelay(token));
			}
			streaming = false;
			await wait(180);
			toolsExpanded = false;
			await wait(9000);

			if (cancelled) return;
			fading = true;
			await wait(380);
			reset();
			fading = false;
			await wait(420);
		}

		async function loop(): Promise<void> {
			const first = SCENES[0];
			if (!first) return;
			if (reducedMotion.matches) {
				showFinished(first);
				return;
			}
			let index = 0;
			while (!cancelled) {
				const next = SCENES[index % SCENES.length];
				if (!next) return;
				await play(next);
				index += 1;
			}
		}

		const observer = new IntersectionObserver(
			(entries) => {
				visible = entries.some((entry) => entry.isIntersecting);
			},
			{ threshold: 0.12, rootMargin: '80px 0px' }
		);
		observer.observe(node);
		void loop();

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
			settle?.();
			observer.disconnect();
		};
	};
</script>

<div
	{@attach runDemo}
	class="pointer-events-none flex h-full min-h-112 flex-col transition-opacity duration-300 lg:min-h-0 {fading
		? 'opacity-0'
		: 'opacity-100'}"
>
	<div class="relative min-h-0 flex-1 overflow-hidden">
		<div data-coach-messages class="no-scrollbar h-full overflow-y-auto">
			<div class="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 sm:px-8 sm:pt-8">
				{#key scene.prompt}
					{#if promptVisible}
						<div
							class="ml-auto flex w-full max-w-[95%] flex-col justify-end gap-2"
							in:fly={{ y: 8, duration: 220 }}
						>
							<div
								class="ml-auto w-fit max-w-[min(42rem,88%)] rounded-lg bg-secondary px-4 py-3 text-base leading-6 text-foreground"
							>
								{scene.prompt}
							</div>
						</div>
					{/if}

					{#if thinking || toolsVisible || replyText}
						<div class="flex w-full max-w-[95%] flex-col gap-2">
							{#if thinking}
								<div role="status">
									<Shimmer as="span" content_length={15} class="text-base">Working on it…</Shimmer>
								</div>
							{/if}

							{#if toolsVisible}
								<div class="group max-w-3xl">
									<div
										class="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm text-muted-foreground"
									>
										<SearchIcon
											class="size-4 shrink-0 {runningTool >= 0
												? 'animate-pulse motion-reduce:animate-none'
												: ''}"
										/>
										<span class="min-w-0 flex-1 truncate font-medium text-foreground/85">
											{activitySummary}
										</span>
										<ChevronDownIcon
											class="size-3.5 shrink-0 opacity-60 transition-transform duration-200 {toolsExpanded
												? 'rotate-180'
												: ''}"
										/>
									</div>
									{#if toolsExpanded}
										<div
											class="ml-2 border-l border-border/70 py-1 pl-4 text-sm leading-6 text-muted-foreground"
										>
											<ul class="space-y-1">
												{#each scene.tools as tool, index (tool.complete)}
													{#if index < completedTools || index === runningTool}
														<li class="flex items-center gap-2" in:fly={{ y: 4, duration: 180 }}>
															{#if index === runningTool}
																<Loader2Icon
																	class="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
																/>
															{/if}
															<SearchIcon class="size-3.5 shrink-0 opacity-70" />
															<span>
																{index === runningTool ? tool.running : tool.complete}
															</span>
														</li>
													{/if}
												{/each}
											</ul>
										</div>
									{/if}
								</div>
							{/if}

							{#if visibleReply}
								<div class="max-w-3xl text-base leading-7 text-foreground">
									<RichText text={visibleReply} blocks />
								</div>
							{/if}
						</div>
					{/if}
				{/key}
			</div>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-3xl shrink-0 flex-col px-4 pb-4 sm:px-8 sm:pb-6">
		<div
			class="rounded-[24px] border border-border/70 bg-background shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.28)]"
		>
			<div class="flex items-end gap-2 py-1.5 pr-1.5 pl-5 sm:pl-6">
				<p
					class="relative min-h-9 min-w-0 flex-1 px-0 py-1.5 text-base leading-6 {composerText
						? 'text-foreground'
						: 'text-muted-foreground/80'}"
				>
					{composerText || 'Ask Coach anything…'}
					{#if composerText && !promptVisible}
						<span
							class="ml-px inline-block h-[1.05em] w-px translate-y-0.5 animate-tutor-caret-blink bg-foreground"
						></span>
					{/if}
				</p>
				<span
					class="flex size-9 shrink-0 items-center justify-center self-end rounded-full transition-transform {SUPER_GRADIENT_BUTTON_CLASS} {canSend
						? ''
						: 'opacity-40'} {sendPressed ? 'scale-95' : ''}"
				>
					{#if composerBusy}
						<SquareIcon class="size-4" />
					{:else}
						<ArrowUpIcon class="size-4" />
					{/if}
				</span>
			</div>
		</div>
	</div>
</div>
