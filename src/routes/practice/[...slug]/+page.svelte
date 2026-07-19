<script lang="ts">
	import { onMount } from 'svelte';
	import PracticeLanding from '$lib/components/practice/practice-landing.svelte';
	import {
		buildPracticePageJsonLd,
		buildPracticeBreadcrumbJsonLd,
		buildPracticePageMeta
	} from '$lib/seo/practice-page-meta.js';
	import type { PageData } from './$types';
	import { capturePostHogEvent } from '$lib/client/posthog-analytics';

	let { data }: { data: PageData } = $props();

	const meta = $derived(buildPracticePageMeta(data.page));
	const jsonLd = $derived(buildPracticePageJsonLd(data.page));
	const breadcrumbJsonLd = $derived(buildPracticeBreadcrumbJsonLd(data.page));

	onMount(() => {
		capturePostHogEvent('practice_page_viewed', {
			ap_class: data.page.className,
			page_type: data.page.type,
			unit: 'unitName' in data.page ? data.page.unitName : undefined
		});
	});
</script>

<svelte:head>
	<title>{meta.title}</title>
	<meta name="title" content={meta.title} />
	<meta name="description" content={meta.description} />
	{#if data.page.seo.keywords}
		<meta name="keywords" content={data.page.seo.keywords} />
	{/if}
	<meta name="author" content="FreeAPPractice.org" />
	<meta
		name="robots"
		content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
	/>
	<meta name="googlebot" content="index, follow" />
	<link rel="canonical" href={meta.url} />

	<meta property="og:type" content="website" />
	<meta property="og:url" content={meta.url} />
	<meta property="og:title" content={meta.ogTitle} />
	<meta property="og:description" content={meta.ogDescription} />
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content={meta.url} />
	<meta name="twitter:title" content={meta.twitterTitle} />
	<meta name="twitter:description" content={meta.twitterDescription} />
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
	<meta name="twitter:site" content="@freeappractice" />

	{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
	{@html `<script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</script>`}
</svelte:head>

<PracticeLanding page={data.page} />
