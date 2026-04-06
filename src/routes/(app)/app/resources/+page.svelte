<script lang="ts">
	import { resolve } from '$app/paths';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	const blogResources = [
		{
			href: resolve('/blog'),
			label: 'Open the blog',
			description: 'Browse all current study guides, updates, and strategy posts.'
		},
		{
			href: resolve('/blog/science_of_studying'),
			label: 'Science of Studying',
			description: 'Research-backed strategies for spacing, retrieval, and retention.'
		},
		{
			href: resolve('/blog/simple_frq_guide'),
			label: 'FRQ Guide',
			description: 'A practical framework for improving free-response scores.'
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

<div class="mx-auto w-full max-w-6xl space-y-8 px-5 py-8 sm:px-8 lg:px-10">
	<div class="space-y-2">
		<h1 class="text-2xl font-semibold tracking-tight">Resources</h1>
		<p class="text-sm text-muted-foreground">
			Curated study guides from our blog and external links worth keeping in your AP toolkit.
		</p>
	</div>

	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root class="h-full">
			<Card.Header>
				<Card.Title>Blog</Card.Title>
				<Card.Description
					>Read the latest in-house study guides and AP strategy posts.</Card.Description
				>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-3">
					{#each blogResources as resource (resource.href)}
						<div class="rounded-lg border border-border bg-muted/20 p-4">
							<p class="font-medium">{resource.label}</p>
							<p class="mt-1 text-sm text-muted-foreground">{resource.description}</p>
							<div class="mt-3">
								<Button variant="outline" href={resource.href}>Open</Button>
							</div>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="h-full">
			<Card.Header>
				<Card.Title>External resources</Card.Title>
				<Card.Description>Official references and supplemental study tools.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#each externalResources as resource (resource.href)}
					<div class="rounded-lg border border-border bg-muted/20 p-4">
						<p class="font-medium">{resource.label}</p>
						<p class="mt-1 text-sm text-muted-foreground">{resource.description}</p>
						<div class="mt-3">
							<Button
								variant="outline"
								href={resource.href}
								target="_blank"
								rel="noopener noreferrer"
							>
								Visit site
							</Button>
						</div>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>
	</div>
</div>
