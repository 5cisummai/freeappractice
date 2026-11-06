<script lang="ts">
	import { resolve } from '$app/paths';
	import { getBrowseCoursesWithUnits } from '#lib/catalog/practice-pages.js';
	import SectionIntro from '#lib/components/marketing/section-intro.svelte';
	import { twAnimateInViewSubtle } from '#lib/tw-animate.js';

	const courses = getBrowseCoursesWithUnits();
</script>

<section id="browse-courses" class="w-full space-y-8" aria-labelledby="browse-courses-heading">
	<SectionIntro id="browse-courses-heading">
		{#snippet title()}
			Browse all courses
		{/snippet}
		{#snippet description()}
			<p>Every AP course and unit, ready to practice. No signup.</p>
		{/snippet}
	</SectionIntro>

	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each courses as course (course.slug)}
			<article
				class="rounded-2xl border border-border/70 bg-card px-4 py-4 {twAnimateInViewSubtle}"
			>
				<a
					href={resolve(`practice/${course.slug}`)}
					class="text-base font-semibold tracking-tight text-foreground hover:text-primary"
				>
					{course.course}
				</a>
				{#if course.units.length > 0}
					<nav class="mt-2" aria-label="{course.course} units">
						<ul class="flex flex-wrap gap-x-2 gap-y-1 text-sm">
							{#each course.units as unit, index (unit.slug)}
								<li class="flex items-center gap-2">
									<a
										href={resolve(`practice/${unit.slug}`)}
										class="text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
										title={unit.label}
									>
										{unit.shortLabel}
									</a>
									{#if index < course.units.length - 1}
										<span class="text-border" aria-hidden="true">·</span>
									{/if}
								</li>
							{/each}
						</ul>
					</nav>
				{/if}
			</article>
		{/each}
	</div>
</section>
