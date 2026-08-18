<script lang="ts">
	import { onMount } from 'svelte';
	import SectionIntro from '$lib/components/marketing/section-intro.svelte';
	import ChevronLeftIcon from '@tabler/icons-svelte/icons/chevron-left';
	import ChevronRightIcon from '@tabler/icons-svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button/index.js';

	type StudentStory = {
		name: string;
		detail: string;
		quote: string;
		initials: string;
		cardClass: string;
		avatarClass: string;
		score: 4 | 5;
	};

	const stories: StudentStory[] = [
		{
			name: 'Jake B.',
			detail: 'Sophomore · AP World',
			quote:
				'I used this all year to ACE my AP World class with Sensei H. The explanations helped me walk into class knowing the best.',
			initials: 'JB',
			score: 4,
			cardClass: 'bg-sky-100 dark:bg-sky-950/50',
			avatarClass: 'bg-sky-200 text-sky-900 dark:bg-sky-900 dark:text-sky-100'
		},
		{
			name: 'Kristian K.',
			detail: 'Freshman · AP Biology',
			quote:
				'Generating questions by unit made it easy to drill weak topics before tests. Way better than flipping through random PDFs. One day or day one.',
			initials: 'KK',
			score: 5,
			cardClass: 'bg-amber-50 dark:bg-amber-950/40',
			avatarClass: 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
		},
		{
			name: 'Sai Tej C.',
			detail: 'Freshman · AP Human Geography',
			quote:
				'AP Practice is the reason I got a 5 in my AP P.E. class. Hardest AP class OAT (and Human Geo).',
			initials: 'STC',
			score: 5,
			cardClass: 'bg-emerald-100 dark:bg-emerald-950/50',
			avatarClass: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
		},
		{
			name: 'Rohan K.',
			detail: 'Freshman · AP Bio',
			quote: 'Finally answered all of my questions.',
			initials: 'RK',
			score: 5,
			cardClass: 'bg-cyan-100 dark:bg-cyan-950/50',
			avatarClass: 'bg-cyan-200 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-100'
		},
		{
			name: 'Matijs S.',
			detail: 'Senior · AP Calculus BC',
			quote:
				'I was deciding between two APs and used this to sample both subjects. It made choosing my schedule way less stressful.',
			initials: 'MS',
			score: 5,
			cardClass: 'bg-rose-100 dark:bg-rose-950/50',
			avatarClass: 'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100'
		},
		{
			name: 'Zarian R.',
			detail: 'Senior · AP Physics C',
			quote:
				'No signup, no paywall—just open the site and practice. That low friction is exactly what I needed during a busy semester of AP Physics C.',
			initials: 'ZR',
			score: 5,
			cardClass: 'bg-violet-100 dark:bg-violet-950/50',
			avatarClass: 'bg-violet-200 text-violet-900 dark:bg-violet-900 dark:text-violet-100'
		}
	];

	let carouselEl = $state<HTMLDivElement | null>(null);
	let activePage = $state(0);
	let pageCount = $state(1);
	let canScrollPrev = $state(false);
	let canScrollNext = $state(true);
	let prefersReducedMotion = $state(false);

	function getPageWidth(): number {
		if (!carouselEl) return 0;
		const card = carouselEl.querySelector<HTMLElement>('[data-story-card]');
		if (!card) return carouselEl.clientWidth;
		const gap = Number.parseFloat(getComputedStyle(carouselEl).columnGap || '0');
		return card.offsetWidth + gap;
	}

	function updateCarouselState(): void {
		if (!carouselEl) return;

		const pageWidth = getPageWidth();
		if (pageWidth <= 0) return;

		const maxScrollLeft = carouselEl.scrollWidth - carouselEl.clientWidth;
		const nextPage = Math.round(carouselEl.scrollLeft / pageWidth);

		activePage = Math.max(0, Math.min(nextPage, pageCount - 1));
		canScrollPrev = carouselEl.scrollLeft > 4;
		canScrollNext = carouselEl.scrollLeft < maxScrollLeft - 4;
	}

	function updatePageCount(): void {
		if (!carouselEl) return;

		const pageWidth = getPageWidth();
		if (pageWidth <= 0) {
			pageCount = 1;
			return;
		}

		const maxScrollLeft = carouselEl.scrollWidth - carouselEl.clientWidth;
		pageCount = Math.max(1, Math.round(maxScrollLeft / pageWidth) + 1);
		updateCarouselState();
	}

	function scrollByPage(direction: -1 | 1): void {
		if (!carouselEl) return;
		carouselEl.scrollBy({
			left: direction * getPageWidth(),
			behavior: prefersReducedMotion ? 'auto' : 'smooth'
		});
	}

	function scrollToPage(page: number): void {
		if (!carouselEl) return;
		carouselEl.scrollTo({
			left: page * getPageWidth(),
			behavior: prefersReducedMotion ? 'auto' : 'smooth'
		});
	}

	function scrollToNextPage(): void {
		if (!carouselEl) return;

		const maxScrollLeft = carouselEl.scrollWidth - carouselEl.clientWidth;
		if (carouselEl.scrollLeft < maxScrollLeft - 4) {
			scrollByPage(1);
		} else {
			scrollToPage(0);
		}
	}

	let autoScrollInterval: ReturnType<typeof setInterval> | undefined;

	function startAutoScroll(): void {
		stopAutoScroll();
		if (prefersReducedMotion || document.hidden || carouselEl?.matches(':focus-within')) return;
		autoScrollInterval = setInterval(scrollToNextPage, 3000);
	}

	function stopAutoScroll(): void {
		if (autoScrollInterval !== undefined) {
			clearInterval(autoScrollInterval);
			autoScrollInterval = undefined;
		}
	}

	onMount(() => {
		if (!carouselEl) return;
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updateMotionPreference = () => {
			prefersReducedMotion = reducedMotion.matches;
			if (prefersReducedMotion) stopAutoScroll();
			else startAutoScroll();
		};
		const handleVisibilityChange = () => {
			if (document.hidden) stopAutoScroll();
			else startAutoScroll();
		};

		const resizeObserver = new ResizeObserver(() => {
			updatePageCount();
		});

		resizeObserver.observe(carouselEl);
		carouselEl.addEventListener('scroll', updateCarouselState, { passive: true });
		carouselEl.addEventListener('mouseenter', stopAutoScroll);
		carouselEl.addEventListener('mouseleave', startAutoScroll);
		reducedMotion.addEventListener('change', updateMotionPreference);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		prefersReducedMotion = reducedMotion.matches;
		updatePageCount();
		startAutoScroll();

		return () => {
			stopAutoScroll();
			resizeObserver.disconnect();
			carouselEl?.removeEventListener('scroll', updateCarouselState);
			carouselEl?.removeEventListener('mouseenter', stopAutoScroll);
			carouselEl?.removeEventListener('mouseleave', startAutoScroll);
			reducedMotion.removeEventListener('change', updateMotionPreference);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});
</script>

<section class="mx-auto w-full max-w-7xl space-y-6" aria-labelledby="aspiring-students-heading">
	<SectionIntro id="aspiring-students-heading">
		{#snippet title()}
			Used by students <span class="underline decoration-primary/70 decoration-2 underline-offset-4"
				>earning 5s</span
			>
		{/snippet}
		{#snippet description()}
			<p>
				See how students plan their AP year, preview courses, and build confidence before exam day.
			</p>
		{/snippet}
	</SectionIntro>

	<div class="flex justify-end gap-2">
		<Button
			variant="ghost"
			size="icon"
			aria-label="Previous student stories"
			disabled={!canScrollPrev}
			onclick={() => scrollByPage(-1)}
		>
			<ChevronLeftIcon />
		</Button>
		<Button
			variant="ghost"
			size="icon"
			aria-label="Next student stories"
			disabled={!canScrollNext}
			onclick={() => scrollByPage(1)}
		>
			<ChevronRightIcon />
		</Button>
	</div>

	<div
		bind:this={carouselEl}
		id="student-stories-carousel"
		class="flex snap-x snap-mandatory scrollbar-none gap-4 overflow-x-auto mask-[linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)] pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden {prefersReducedMotion
			? 'scroll-auto'
			: 'scroll-smooth'}"
		role="region"
		aria-label="Student testimonials carousel"
		aria-roledescription="carousel"
		onfocusin={stopAutoScroll}
		onfocusout={startAutoScroll}
	>
		{#each stories as story (story.name)}
			<article
				data-story-card
				class="flex w-[min(100%,20rem)] shrink-0 snap-start flex-col gap-5 rounded-3xl p-6 marketing-card-shadow sm:w-80 {story.cardClass}"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold {story.avatarClass}"
						aria-hidden="true"
					>
						{story.initials}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate font-semibold text-foreground">{story.name}</p>
						<p class="truncate text-sm text-muted-foreground">{story.detail}</p>
					</div>
					<div
						class="flex size-12 shrink-0 rotate-12 items-center justify-center rounded-full border-2 border-rose-700/75 p-0.5 text-rose-700/80 dark:border-rose-400/70 dark:text-rose-400/80"
						role="img"
						aria-label="Score {story.score}"
					>
						<span
							class="flex size-full items-center justify-center rounded-full border-2 border-current font-display text-lg leading-none font-medium"
						>
							{story.score}
						</span>
					</div>
				</div>
				<blockquote class="text-base leading-7 text-foreground/90">
					“{story.quote}”
				</blockquote>
			</article>
		{/each}
	</div>

	<div class="flex justify-center">
		<div class="flex items-center gap-2" role="group" aria-label="Carousel pages">
			{#each Array.from({ length: pageCount }, (_, index) => index) as page (page)}
				<button
					type="button"
					aria-current={activePage === page ? 'true' : undefined}
					aria-controls="student-stories-carousel"
					aria-label={`Go to page ${page + 1}`}
					class="size-2 rounded-full transition-colors {activePage === page
						? 'bg-foreground'
						: 'bg-muted-foreground/30 hover:bg-muted-foreground/50'}"
					onclick={() => scrollToPage(page)}
					onkeydown={(event) => {
						if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
							event.preventDefault();
							const direction = event.key === 'ArrowLeft' ? -1 : 1;
							scrollToPage(Math.max(0, Math.min(pageCount - 1, page + direction)));
						}
					}}
				></button>
			{/each}
		</div>
	</div>
</section>
