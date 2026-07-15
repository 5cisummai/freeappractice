<script lang="ts">
	import QuestionShell from '$lib/components/question-shell.svelte';
	import PracticeBreadcrumbs from '$lib/components/practice-breadcrumbs.svelte';
	import PracticeHubNav from '$lib/components/practice-hub-nav.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Topbar from '$lib/components/topbar.svelte';
	import type { PracticePage } from '$lib/catalog/practice-pages.js';
	import { buildPracticeBreadcrumbs } from '$lib/seo/practice-page-meta.js';

	function getInitialSelection(practicePage: PracticePage) {
		return {
			selectedClass: practicePage.className,
			selectedUnit:
				practicePage.type === 'unit' && practicePage.unitName ? practicePage.unitName : ''
		};
	}

	let { page: practicePage }: { page: PracticePage } = $props();

	const crumbs = $derived(buildPracticeBreadcrumbs(practicePage));
	const initial = $derived(getInitialSelection(practicePage));

	function linkRel(kind: (typeof practicePage.links)[number]['kind']): string | undefined {
		if (kind === 'external' || kind === 'college-board') {
			return 'noopener noreferrer';
		}
		return undefined;
	}

	function linkTarget(
		href: string,
		kind: (typeof practicePage.links)[number]['kind']
	): string | undefined {
		if (kind === 'internal' || kind === 'practice' || !href.startsWith('http')) {
			return undefined;
		}
		return '_blank';
	}
</script>

<div class="relative isolate flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main id="main-content" class="flex-1">
		<div class="mx-auto w-full max-w-7xl space-y-12 px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
			<section class="mx-auto max-w-5xl space-y-6">
				<PracticeBreadcrumbs {crumbs} />

				<div class="space-y-3 text-center">
					<h1
						class="font-display text-3xl leading-[1.15] font-medium tracking-tight text-balance sm:text-4xl lg:text-5xl"
					>
						{practicePage.seo.h1}
					</h1>
					{#if practicePage.seo.subtitle}
						<p class="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
							{practicePage.seo.subtitle}
						</p>
					{/if}
				</div>
			</section>

			<section>
				<QuestionShell selectedClass={initial.selectedClass} selectedUnit={initial.selectedUnit} />
			</section>

			<section class="mx-auto max-w-3xl">
				<PracticeHubNav page={practicePage} />

				<article class="prose prose-neutral dark:prose-invert mt-10 max-w-none space-y-4">
					{#each practicePage.article.paragraphs as paragraph, index (index)}
						<p class="text-base leading-7 text-muted-foreground">{paragraph}</p>
					{/each}
				</article>

				{#if practicePage.links.length > 0}
					<div class="mt-8 border-t border-border/70 pt-6">
						<h2 class="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
							Helpful resources
						</h2>
						<ul class="space-y-2">
							{#each practicePage.links as link (link.href)}
								<li>
									<!-- Catalog links are validated internal paths or explicit external URLs. -->
									<!-- eslint-disable svelte/no-navigation-without-resolve -->
									<a
										href={link.href}
										class="text-sm text-primary underline-offset-4 hover:underline"
										target={linkTarget(link.href, link.kind)}
										rel={linkRel(link.kind)}
									>
										{link.label}
									</a>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</section>
		</div>
	</main>

	<SiteFooter />
</div>
