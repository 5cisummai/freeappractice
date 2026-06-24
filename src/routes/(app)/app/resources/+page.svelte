<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PageShell from '$lib/components/page-shell.svelte';
	import { appCard, appInsetPanel, appPrimaryButton } from '$lib/app-ui.js';

	const blogResources = [
		{
			href: resolve('/blog'),
			label: 'Open the blog',
			description: 'Browse all current study guides, updates, and strategy posts.'
		},
		{
			href: resolve('/blog/science-of-studying'),
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
	description="Curated study guides from our blog and external links worth keeping in your AP toolkit."
>
	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root class="{appCard} h-full">
			<Card.Header>
				<Card.Title class="font-display text-lg font-medium tracking-tight">Blog</Card.Title>
				<Card.Description>
					Read the latest in-house study guides and AP strategy posts.
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-3">
					{#each blogResources as resource (resource.href)}
						<div class={appInsetPanel}>
							<p class="font-medium">{resource.label}</p>
							<p class="mt-1 text-sm text-muted-foreground">{resource.description}</p>
							<div class="mt-3">
								<Button variant="outline" href={resource.href} class={appPrimaryButton}>Open</Button
								>
							</div>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="{appCard} h-full">
			<Card.Header>
				<Card.Title class="font-display text-lg font-medium tracking-tight">
					External resources
				</Card.Title>
				<Card.Description>Official references and supplemental study tools.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each externalResources as resource (resource.href)}
					<div class={appInsetPanel}>
						<p class="font-medium">{resource.label}</p>
						<p class="mt-1 text-sm text-muted-foreground">{resource.description}</p>
						<div class="mt-3">
							<Button
								variant="outline"
								href={resource.href}
								target="_blank"
								rel="noopener noreferrer"
								class={appPrimaryButton}
							>
								Visit site
							</Button>
						</div>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	</div>
</PageShell>
