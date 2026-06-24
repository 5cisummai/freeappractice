<script lang="ts">
	import QuestionShell from '$lib/components/question-shell.svelte';
	import PracticeBreadcrumbs from '$lib/components/practice-breadcrumbs.svelte';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Topbar from '$lib/components/topbar.svelte';
	import { CUSTOM_UNIT_VALUE } from '$lib/constants/custom-unit';
	import type { PracticePage } from '$lib/practice-pages.js';
	import { buildPracticeBreadcrumbs } from '$lib/seo/practice-page-meta.js';

	function getInitialSelection(page: PracticePage) {
		return {
			selectedClass: page.className,
			selectedUnit:
				page.type === 'unit' && page.unitName
					? page.unitName
					: page.type === 'topic'
						? CUSTOM_UNIT_VALUE
						: '',
			customTopic: page.type === 'topic' ? (page.customTopic ?? '') : ''
		};
	}

	let { page }: { page: PracticePage } = $props();

	const crumbs = $derived(buildPracticeBreadcrumbs(page));
	const initial = getInitialSelection(page);

	function linkHref(href: string): string {
		return href;
	}

	function linkRel(kind: PracticePage['links'][number]['kind']): string | undefined {
		if (kind === 'external' || kind === 'college-board') {
			return 'noopener noreferrer';
		}
		return undefined;
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
						{page.seo.h1}
					</h1>
					{#if page.seo.subtitle}
						<p class="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
							{page.seo.subtitle}
						</p>
					{/if}
				</div>
			</section>

			<section>
				<QuestionShell
					selectedClass={initial.selectedClass}
					selectedUnit={initial.selectedUnit}
					customTopic={initial.customTopic}
				/>
			</section>

			<section class="mx-auto max-w-3xl">
				<article class="prose prose-neutral dark:prose-invert max-w-none space-y-4">
					{#each page.article.paragraphs as paragraph, index (index)}
						<p class="text-base leading-7 text-muted-foreground">{paragraph}</p>
					{/each}
				</article>

				{#if page.links.length > 0}
					<div class="mt-8 border-t border-border/70 pt-6">
						<h2 class="mb-3 text-sm font-semibold tracking-wide text-foreground uppercase">
							Helpful resources
						</h2>
						<ul class="space-y-2">
							{#each page.links as link (link.href)}
								<li>
									<a
										href={linkHref(link.href)}
										class="text-sm text-primary underline-offset-4 hover:underline"
										target={link.href.startsWith('http') ? '_blank' : undefined}
										rel={linkRel(link.kind)}
									>
										{link.label}
									</a>
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
