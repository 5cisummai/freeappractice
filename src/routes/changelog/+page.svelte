<script lang="ts">
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Topbar from '$lib/components/topbar.svelte';

	const changelog = [
		{
			version: 'v1.2.2',
			date: 'March 26, 2026',
			sections: [
				{
					title: 'Changes',
					items: [
						'Added more settings options for a better user experience',
						'Improved code security across the application'
					]
				},
				{
					title: 'Warning',
					items: [
						'Version 1.3.0 will migrate the project to SvelteKit while keeping compatible APIs, which is why this release is not a 2.0.0 major version'
					]
				}
			]
		},
		{
			version: 'v1.2.1',
			date: 'March 2, 2026',
			sections: [
				{
					title: 'Fixes',
					items: [
						'Fixed UI errors and topbar consistency across pages',
						'Fixed no settings button when not logged in',
						'Fixed questions not being saved properly'
					]
				},
				{
					title: 'Changes',
					items: [
						'Code now renders using highlight.js with tokyo night theme',
						'Icons changed to consistent solid svgs'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Optimized more code, and also cleaned it up',
						'Improved prompting for tutor responses, prohibiting it from giving answers',
						'404 error directs to "Not Found" page'
					]
				},
				{
					title: 'Technical',
					items: [
						'Changed server security to helmet.js',
						'Changed request logging to use the structured server logger'
					]
				}
			]
		},
		{
			version: 'v1.2.0',
			date: 'February 20, 2026',
			sections: [
				{
					title: 'Changes',
					items: [
						'Project is now Open-Source, repo at github.com/5cisummai/freeappractice',
						'Added optional cookies for analytics features that improve this site'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Optimized backend code, removing depricated features',
						'Updated node modules to lastest versions'
					]
				}
			]
		},
		{
			version: 'v1.1.1',
			date: 'January 25, 2026',
			sections: [
				{
					title: 'Fixes',
					items: [
						'Fixed UI errors and topbar consistency across pages',
						'Improved SEO optimization across pages'
					]
				}
			]
		},
		{
			version: 'v1.1.0 - Update',
			date: 'January 22, 2026',
			sections: [
				{
					title: 'New Features',
					items: [
						'User accounts: track progress and stats across devices',
						'New AI Tutor: interactive assistant to help with questions and explanations'
					]
				},
				{
					title: 'Fixes',
					items: [
						'Bug fix for question progress tracker',
						'Mobile responsiveness fixes',
						'Theme consistency and messy UI fixes',
						'Fixed question caching consistency'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Greatly improved question generation accuracy',
						'Performance improvements with dynamic JS loading and HTML components model'
					]
				},
				{
					title: 'Technical',
					items: [
						'Server logging improved for better diagnostics and observability',
						'Every-question storage now backed by AWS S3 (durable, searchable storage)',
						'Updated privacy handling for account data and S3 storage guidance',
						'Dependency and build improvements to reduce runtime module issues'
					]
				}
			]
		},
		{
			version: 'v1.0.2',
			date: 'January 4, 2026',
			sections: [
				{
					title: 'Fixes',
					items: ['Fixed critical bug that prevented user from getting questions']
				},
				{
					title: 'Improvements',
					items: [
						'Fixed theme consistency across pages',
						'Fixed UI consistency across pages.',
						'Focus Mode UI improvements'
					]
				}
			]
		},
		{
			version: 'v1.0.1',
			date: 'January 3, 2026',
			sections: [
				{
					title: 'Improvements',
					items: ['Fixed mobile responsiveness.']
				}
			]
		}
	];
</script>

<svelte:head>
	<title>Changelog – Free AP Practice</title>
	<meta name="description" content="Changelog and release notes for Free AP Practice" />
	<meta name="author" content="FreeAPPractice.org" />
	<meta name="robots" content="index, follow" />
	<link rel="canonical" href="https://freeappractice.org/changelog" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/changelog" />
	<meta property="og:title" content="Changelog – Free AP Practice" />
	<meta property="og:description" content="Changelog and release notes for Free AP Practice" />
	<meta property="og:image" content="https://freeappractice.org/assets/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/changelog" />
	<meta name="twitter:title" content="Changelog – Free AP Practice" />
	<meta name="twitter:description" content="Changelog and release notes for Free AP Practice" />
	<meta name="twitter:image" content="https://freeappractice.org/assets/icon.png" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main class="flex-1 py-12">
		<div class="mx-auto w-full max-w-3xl space-y-8 px-5 sm:px-8">
			<a href="/" class="text-sm text-muted-foreground hover:text-foreground">← Back to Home</a>

			<div class="space-y-2">
				<h1 class="text-4xl font-semibold tracking-tight">Changelog</h1>
				<p class="text-sm text-muted-foreground">Last Updated: March 26, 2026</p>
			</div>

			<div class="space-y-12 pt-8">
				{#each changelog as entry}
					<article class="space-y-4">
						<div
							class="flex flex-col space-y-1 sm:flex-row sm:items-baseline sm:justify-between sm:space-y-0"
						>
							<h2 class="text-2xl font-bold text-blue-600 dark:text-blue-400">{entry.version}</h2>
							<time class="text-sm text-muted-foreground">{entry.date}</time>
						</div>

						<div class="space-y-6">
							{#each entry.sections as section}
								<div class="space-y-2">
									<h3 class="text-lg font-semibold">{section.title}</h3>
									<ul class="list-inside list-disc space-y-1.5 text-muted-foreground">
										{#each section.items as item}
											<li>{item}</li>
										{/each}
									</ul>
								</div>
							{/each}
						</div>

						{#if entry !== changelog[changelog.length - 1]}
							<hr class="mt-12 border-border" />
						{/if}
					</article>
				{/each}
			</div>
		</div>
	</main>

	<SiteFooter />
</div>
