<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PageShell from '$lib/components/layout/page-shell.svelte';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

	const blogResources = [
		{
			path: '/blog' as const,
			label: 'Open the blog',
			description: 'Browse all current study guides, updates, and strategy posts.'
		},
		{
			path: '/blog/science-of-studying' as const,
			label: 'Science of Studying',
			description: 'Research-backed strategies for spacing, retrieval, and retention.'
		}
	];

	const externalResources = [
		{
			href: 'https://apstudents.collegeboard.org/',
			label: 'AP Students',
			description: 'Official College Board landing page for AP exam information and course details.'
		},
		{
			href: 'https://apcentral.collegeboard.org/',
			label: 'AP Central',
			description: 'Official course materials, scoring guidelines, and exam resources.'
		},
		{
			href: 'https://www.khanacademy.org/',
			label: 'Khan Academy',
			description: 'Free practice and review for a wide range of academic subjects.'
		},
		{
			href: 'https://www.fiveable.me/',
			label: 'Fiveable',
			description: 'Community study guides, live review sessions, and AP support.'
		}
	];
</script>

<svelte:head>
	<title>Resources - Free AP Practice</title>
	<meta
		name="description"
		content="Study guides from the Free AP Practice blog and trusted external AP resources."
	/>
</svelte:head>

<PageShell
	title="Resources"
	description="Study guides and official links worth keeping in your AP toolkit."
>
	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root class="h-full rounded-2xl border border-border/60 shadow-sm ring-0">
			<Card.Header>
				<Card.Title class="font-display text-lg font-medium tracking-tight">From our blog</Card.Title>
				<Card.Description>In-house study guides and AP strategy posts.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-1 pt-0">
				{#each blogResources as resource (resource.path)}
					<a
						href={resolve(resource.path)}
						class="group flex items-start justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50"
					>
						<div class="min-w-0">
							<p class="font-medium group-hover:text-primary">{resource.label}</p>
							<p class="mt-0.5 text-sm text-muted-foreground">{resource.description}</p>
						</div>
						<span
							class="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary"
						>
							Read
							<ArrowRightIcon class="size-3.5" />
						</span>
					</a>
				{/each}
			</Card.Content>
		</Card.Root>

		<Card.Root class="h-full rounded-2xl border border-border/60 shadow-sm ring-0">
			<Card.Header>
				<Card.Title class="font-display text-lg font-medium tracking-tight">
					Helpful links
				</Card.Title>
				<Card.Description>Official references and supplemental study tools.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-1 pt-0">
				{#each externalResources as resource (resource.href)}
					<div
						class="group flex items-start justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50"
					>
						<div class="min-w-0">
							<p class="font-medium">{resource.label}</p>
							<p class="mt-0.5 text-sm text-muted-foreground">{resource.description}</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							href={resource.href}
							target="_blank"
							rel="noopener noreferrer"
							class="mt-0.5 h-auto shrink-0 gap-1 px-0 text-xs font-medium text-primary hover:bg-transparent hover:text-primary"
						>
							Visit
							<ExternalLinkIcon class="size-3.5" />
						</Button>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	</div>
</PageShell>
