<script lang="ts">
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Topbar from '$lib/components/topbar.svelte';

	const changelog = [
		{
			version: '1.3.0',
			date: 'March 31, 2026',
			sections: [
				{
					title: 'Major Changes',
					items: [
						'Migrated project to SvelteKit while keeping compatible APIs'
					]

				},
				{
					title: 'New Features',
					items: [
						'Added a new dashboard for loggin in users including a home, practice, progress and settings page',
						'Added alpha support for FRQs for logged in users, does not affect progress statistics yet'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Optimized SvelteKit integration for faster page loads and better routing',
						'Fixed awkward UI for practicing questions on mobile devices'

					]
				}
			]
		},
		{
			version: '1.2.2',
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
						'Version 1.3.0 will migrate the project to SvelteKit while keeping compatible APIs'
					]
				}
			]
		},
		{
			version: '1.2.1',
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
			version: '1.2.0',
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
			version: '1.1.1',
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
			version: '1.1.0 - Update',
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
			version: '1.0.2',
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
			version: '1.0.1',
			date: 'January 3, 2026',
			sections: [
				{
					title: 'Improvements',
					items: ['Fixed mobile responsiveness.']
				}
			]
		},
		{
			version: '1.0.0 - Stable Release',
			date: 'December 28, 2025',
			sections: [
				{
					title: 'Major Features',
					items: [
						'Intelligent hybrid caching system: Instant first question from database cache, fresh AI-generated questions for subsequent requests',
						'Smart prefetch system: Next question pre-generates in the background while you review the current one',
						'Enhanced question variety: Each new question uses a random unit selection for maximum diversity',
						'MongoDB question cache with automatic background refresh',
						'Seamless provider fallback: Automatically switches from local to OpenAI if local model fails'
					]
				},
				{
					title: 'Performance Improvements',
					items: [
						'First question now loads instantly from pre-cached database',
						'Subsequent questions appear instantly from client-side prefetch cache',
						'Background refresh keeps database cache up-to-date without blocking user requests',
						'Optimized API architecture with service layer separation',
						'Rate limiting (20 req/min) for OpenAI provider to manage costs'
					]
				},
				{
					title: 'Bug Fixes',
					items: [
						'Fixed MongoDB connection errors with deprecated options',
						'Resolved provider variable scope issues in error handling',
						'Fixed LaTeX rendering issues with proper JSON escaping',
						'Corrected cache key behavior when switching between classes/units'
					]
				},
				{
					title: 'Technical Details',
					items: [
						'Refactored API to accept className and unit parameters directly',
						'Implemented skipCache parameter for prefetch vs initial request control',
						'Database cache always uses OpenAI for consistent quality',
						'Client-side hasShownFirstQuestion flag for session state management',
						'Unit range handling now correctly picks random units for variety'
					]
				},
				{
					title: 'Warnings',
					items: [
						'Some cached questions may be of lower quality as they were generated with earlier, less refined prompts. New questions generated after this update will use the latest improved prompts for better accuracy and relevance.',
						'Some cached questions may contain formatting issues due to previous JSON escaping bugs. New questions will have correct formatting.'
					]
				}
			]
		},
		{
			version: '0.9.4 - Beta',
			date: 'December 19, 2025',
			sections: [
				{
					title: 'Improvements',
					items: [
						'Questions are now more accurate per class and per unit',
						'More data for questions to be created on'
					]
				},
				{
					title: 'Changes',
					items: ['Added Advertisements to run when ever it is not testing times']
				}
			]
		},
		{
			version: '0.9.3 - Beta',
			date: 'December 16, 2025',
			sections: [
				{
					title: 'Fixes',
					items: [
						'Changelog page now follows the correct color theme',
						'Settings button now toggles the setting modal rather than just opening it'
					]
				},
				{
					title: 'Changes',
					items: [
						'More complex subjects now use gpt-5-mini instead of o4-mini',
						'Order of elements in footer changed'
					]
				},
				{
					title: 'Improvements',
					items: [
						'New show/hide button for the progress sidebar',
						'How to use section now more interactive'
					]
				}
			]
		},
		{
			version: '0.9.2 - Beta',
			date: 'December 15, 2025',
			sections: [
				{
					title: 'Changes',
					items: ['Removed info about AI provider while a question is showning']
				},
				{
					title: 'Improvements',
					items: [
						'Improved prompt wording to enhance formatting in answer choices and explanations',
						'Added a "Show Explanation" toggle for referring back to explanations'
					]
				}
			]
		},
		{
			version: '0.9.1 - Beta',
			date: 'December 15, 2025',
			sections: [
				{
					title: 'Improvements',
					items: [
						'Improved unit selection logic for "All Units" and custom range modes',
						'Questions now randomly select a single unit from the range instead of trying to cover multiple units',
						'Better question quality by focusing on specific unit content'
					]
				}
			]
		},
		{
			version: '0.9.0 - Beta',
			date: 'December 15, 2025',
			sections: [
				{
					title: 'Initial Release',
					items: [
						'Launch of FreeAPPractice.org (Beta)',
						'Support for 20+ AP subjects',
						'AI-powered question generation',
						'Dual provider support: Local (LM Studio) and OpenAI',
						'Real-time feedback and detailed explanations',
						'Customizable theme (Light/Dark/System)',
						'Local progress tracking',
						'Focus Mode for distraction-free practice',
						'Customizable unit range selection with range slider',
						'Progress tracking sidebar showing performance metrics',
						'Math rendering with KaTeX for equation display',
						'Code syntax highlighting with Highlight.js',
						'Question caching for improved performance',
						'Responsive design for mobile and desktop devices',
						'Comprehensive FAQ and documentation',
						'Bug report feature for user feedback',
						'Privacy-focused design with local data storage'
					]
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
				<p class="text-sm text-muted-foreground">Last Updated: March 31, 2026</p>
			</div>

			<div class="space-y-12 pt-8">
				{#each changelog as entry (entry.version)}
					<article class="space-y-4">
						<div
							class="flex flex-col space-y-1 sm:flex-row sm:items-baseline sm:justify-between sm:space-y-0"
						>
							<h2 class="text-2xl font-bold text-blue-600 dark:text-blue-400">{entry.version}</h2>
							<time class="text-sm text-muted-foreground">{entry.date}</time>
						</div>

						<div class="space-y-6">
							{#each entry.sections as section (section.title)}
								<div class="space-y-2">
									<h3 class="text-lg font-semibold">{section.title}</h3>
									<ul class="list-inside list-disc space-y-1.5 text-muted-foreground">
										{#each section.items as item (item)}
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
