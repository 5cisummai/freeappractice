<script lang="ts">
	import PublicPageHero from '$lib/components/marketing/public-page-hero.svelte';
	import BackToHome from '$lib/components/layout/back-to-home.svelte';
	import { resolve } from '$app/paths';

	const changelog = [
		{
			version: '1.4.8',
			date: 'July 18, 2026',
			sections: [
				{
					title: 'Fixes',
					items: [
						'Fixed live question generation failing with a 500 when the OpenAI structured-output schema treated progressive hints as optional',
						'Question card now shows a clear retryable error state instead of a blank panel when generation fails'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Structured AI schemas for question generation are checked at module load so incompatible optional fields fail fast in tests and startup',
						'Added unit and mocked pipeline coverage for MCQ generation schema compatibility and persistence'
					]
				}
			]
		},
		{
			version: '1.4.7',
			date: 'July 16, 2026',
			sections: [
				{
					title: 'New Features',
					items: [
						'Some practice sessions now support multiple answer attempts with progressive hints before a question is finalized',
						'Practice history records multi-attempt outcomes, including the final resolved answer and hints shown'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Redesigned Settings page brings practice, appearance, privacy, account, and release details into one easier-to-scan view',
						'Email verification, email changes, password resets, and account deletion now provide clearer confirmation and recovery flows',
						'Password limits and authentication request limits are now applied consistently for safer, more reliable account access',
						'Practice and navigation layouts work more smoothly across screen sizes, including fullscreen question mode'
					]
				},
				{
					title: 'Fixes',
					items: [
						'Email delivery failures now surface clear feedback so verification and recovery attempts do not fail silently',
						'AI tutor replies stop cleanly when the tutor is closed or Escape is pressed'
					]
				}
			]
		},
		{
			version: '1.4.6',
			date: 'July 14, 2026',
			sections: [
				{
					title: 'New Features',
					items: [
						'Realistic mode gives practice questions a cleaner, exam-style presentation and remembers your preference',
						'Choose a custom range of units for mixed-unit practice instead of practicing one unit or every unit',
						'Share your current class or unit practice page, or invite a classmate from the app sidebar',
						'Flag a wrong answer, unclear question, or unclear explanation directly after reviewing a question'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Bug reports now stay open with a clear confirmation after they are submitted',
						'Sign-up and password forms work better with browser autofill and password managers',
						'Practice history rows can be opened with the keyboard, and copying a question ID now shows success or failure feedback'
					]
				},
				{
					title: 'Fixes',
					items: ['Closing the AI tutor now stops its active reply instead of leaving it running']
				}
			]
		},
		{
			version: '1.4.5',
			date: 'July 11, 2026',
			sections: [
				{
					title: 'Improvements',
					items: [
						'Practice is clearer: pick an AP class and unit, then generate — no extra topic setup',
						'AI tutor chats are more reliable, with safer limits so long or stuck replies don’t hang forever',
						'Old topic practice links (like photosynthesis or limits) now open the matching unit page instead of a dead end'
					]
				},
				{
					title: 'Changes',
					items: [
						'Custom-topic question generation has been removed so every question stays tied to a real AP unit'
					]
				}
			]
		},
		{
			version: '1.4.4',
			date: 'July 9, 2026',
			sections: [
				{
					title: 'New Features',
					items: [
						'Question pool now excludes previously seen question IDs so practice sessions feel fresher',
						'Refreshed sidebar user menu with avatar, settings shortcut, and sign-out',
						'Dedicated theme toggle in the app shell (light, dark, and system)'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Streamlined question pool and cache handling for faster, more reliable delivery',
						'Simplified admin cache dashboard aligned with the updated pool structure',
						'History in Progress sorts consistently across paginated results',
						'Daily streaks now count by your local calendar day',
						'Cleaner landing page with simplified background styling',
						'Dark mode color refinements and sidebar layout polish'
					]
				},
				{
					title: 'Fixes',
					items: [
						'More reliable attempt recording with validated question IDs and answer data',
						'Capped attempt timing to prevent outlier values from skewing stats',
						'History detail drawer spacing and layout fixes'
					]
				}
			]
		},
		{
			version: '1.4.3',
			date: 'June 24, 2026',
			sections: [
				{
					title: 'New Features',
					items: [
						'Practice landing pages for every AP class, unit, and topic at /practice — easier to find and share study pages',
						'Practice hub navigation to browse units, featured topics, and jump to related pages',
						'Public generation stats on /stats showing how many questions have been created across subjects'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Breadcrumbs and clearer navigation on practice pages',
						'Related links on blog posts to surface more study resources',
						'Updated footer with contact links and more consistent site navigation',
						'Simplified settings by removing the font size control',
						'Cleaner question history table in the Progress tab'
					]
				},
				{
					title: 'Fixes',
					items: ['Practice page and question card bug fixes']
				}
			]
		},
		{
			version: '1.4.2',
			date: 'June 23, 2026',
			sections: [
				{
					title: 'New Features',
					items: [
						'Google One Tap sign-in for faster account access',
						'Redesigned question history in Progress — sortable table, detail view, and pagination',
						'Refreshed practice subject pages with a cleaner layout',
						'Blog posts now show cover images',
						'Homepage aspiring-students section with auto-scrolling highlights',
						'Consistent hero headers across public pages (about, changelog, stats, and more)'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Updated about page',
						'Refined app sidebar layout',
						'Homepage features section refresh',
						'App-wide toast notifications for action feedback',
						'Progress and history page polish'
					]
				},
				{
					title: 'Fixes',
					items: [
						'Fixed AI tutor display in fullscreen question mode',
						'Fixed broken Resources link in the app',
						'Settings reset and question flow reliability fixes'
					]
				},
				{
					title: 'Changes',
					items: [
						'Practice focused on multiple-choice questions (written-response/FRQ mode removed)',
						'Simplified settings by removing unused options'
					]
				}
			]
		},
		{
			version: '1.4.1',
			date: 'June 19, 2026',
			sections: [
				{
					title: 'Authentication',
					items: [
						'Migrated authentication fully to Better Auth, replacing custom JWT handling with secure session cookies',
						'Google sign-in, email/password, verification, and password reset now flow through Better Auth',
						'User data APIs moved from /api/auth/* to /api/me/*; legacy auth endpoints removed',
						'Server-side session loading for app routes, with trusted-origin and callback URL hardening'
					]
				},
				{
					title: 'Infrastructure',
					items: [
						'Docker Compose config for local MongoDB during auth development',
						'Updated environment variables and README for Better Auth setup'
					]
				}
			]
		},
		{
			version: '1.4.0',
			date: 'June 18, 2026',
			sections: [
				{
					title: 'New Features',
					items: [
						'Question history in the Progress tab with pagination for signed-in users',
						'Summer study guide at /summer with a 4-week Unit 1 preview plan',
						'Homepage aspiring-students section and refreshed messaging around course planning',
						'AP Lunch😂 — a joke subject with cafeteria-themed practice questions',
						'Two new blog posts: Which APs to take and Summer AP study plan',
						'Skip-to-main-content link for keyboard and screen-reader users',
						'PageShell layout component for consistent app page structure'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Migrated AI question generation and tutoring to the Vercel AI SDK',
						'Refactored authenticated API routes with shared auth and error-handling helpers',
						'Updated privacy and terms pages',
						'Typography refresh across marketing pages',
						'Switched package manager to Bun',
						'GitHub Actions workflow for Afterlane deploy verification'
					]
				},
				{
					title: 'Fixes',
					items: [
						'Fixed topbar menu stacking above animated hero content',
						'Removed unused progress-detailed API endpoint and dead UI components'
					]
				},
				{
					title: 'Testing',
					items: ['Playwright test ensuring unauthenticated users are redirected from history']
				}
			]
		},
		{
			version: '1.3.6',
			date: 'May 17, 2026',
			sections: [
				{
					title: 'Fixes',
					items: ['Bug fixes and edge-case handling across practice and account flows']
				},
				{
					title: 'AI',
					items: [
						'Model upgrades for question generation, batch analysis, and tutor responses (gpt-5.4-mini)'
					]
				},
				{
					title: 'Stability',
					items: ['Stability improvements for reliability, performance, and error recovery']
				}
			]
		},
		{
			version: '1.3.5',
			date: 'April 24, 2026',
			sections: [
				{
					title: 'New Features',
					items: ['Added AP Spanish support']
				},
				{
					title: 'Fixes',
					items: ['Bug fixes']
				},
				{
					title: 'Security',
					items: [
						'Security hardening',
						'Refactored Content Security Policy (CSP) handling for Svelte'
					]
				}
			]
		},
		{
			version: '1.3.4',
			date: 'April 16, 2026',
			sections: [
				{
					title: 'New Features',
					items: ['Added a stats API and a new stats page at /stats']
				},
				{
					title: 'Fixes',
					items: ['Fixed UI inconsistencies across various pages']
				},
				{
					title: 'Removals',
					items: ['Removed incorrect reference sheets']
				}
			]
		},
		{
			version: '1.3.3',
			date: 'April 6, 2026',
			sections: [
				{
					title: 'New Features',
					items: [
						'Added enhancements to the calculator experience',
						'Improved reference sheets with better navigation and display'
					]
				},
				{
					title: 'Improvements',
					items: [
						'Optimized code for better performance and reuse across components',
						'Refined practice handling with slight quality improvements'
					]
				}
			]
		},
		{
			version: '1.3.2',
			date: 'April 3, 2026',
			sections: [
				{
					title: 'Improvements',
					items: [
						'Questions now rarely repeat the same topics within a unit',
						'Improved mobile responsiveness for blog posts',
						'Added quick actions to blog posts',
						'Improved styling of the about page'
					]
				}
			]
		},
		{
			version: '1.3.1',
			date: 'April 1, 2026',
			sections: [
				{
					title: 'New Additions',
					items: ['Added a blog with 4 articles so far', 'Added an about page']
				},
				{
					title: 'Improvements',
					items: [
						'Fixed mobile responsive design on the topbar and sidebar',
						'Fixed inconsistent design for logged in users',
						'Improved accessibility with better ARIA attributes and keyboard navigation',
						'Improved consistency of UI elements across pages, including buttons and links',
						'Improved SEO optimization with better meta tags and structured data'
					]
				}
			]
		},
		{
			version: '1.3.0',
			date: 'March 31, 2026',
			sections: [
				{
					title: 'Major Changes',
					items: ['Migrated project to SvelteKit while keeping compatible APIs']
				},
				{
					title: 'New Features',
					items: [
						'Added a new dashboard for loggin in users including a home, practice, progress and settings page',
						'Added practice improvements for logged in users'
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
						'Added optional analytics preference controls'
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
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/changelog" />
	<meta name="twitter:title" content="Changelog – Free AP Practice" />
	<meta name="twitter:description" content="Changelog and release notes for Free AP Practice" />
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<main id="main-content" class="flex-1 py-12">
	<div class="mx-auto w-full max-w-3xl space-y-8 px-5 sm:px-8">
		<BackToHome />

		<PublicPageHero
			title="Changelog"
			description="Release notes and updates for Free AP Practice."
			meta="Last Updated: July 9, 2026"
		/>

		<div class="space-y-12 pt-8">
			{#each changelog as entry (entry.version)}
				<article class="space-y-4">
					<div
						class="flex flex-col space-y-1 sm:flex-row sm:items-baseline sm:justify-between sm:space-y-0"
					>
						<h2 class="text-2xl font-bold">{entry.version}</h2>
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

		<section class="mt-16 rounded-2xl border border-border bg-muted/30 px-6 py-8">
			<h2 class="text-xl font-semibold tracking-tight">Explore the site</h2>
			<p class="mt-2 text-sm text-muted-foreground">
				Jump to the pages mentioned throughout these release notes.
			</p>
			<ul class="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
				<li>
					<a href={resolve('/subjects')} class="underline-offset-2 hover:underline">Subjects</a>
				</li>
				<li>
					<a href={resolve('/summer')} class="underline-offset-2 hover:underline">Summer guide</a>
				</li>
				<li>
					<a href={resolve('/stats')} class="underline-offset-2 hover:underline">Stats</a>
				</li>
				<li>
					<a href={resolve('/blog')} class="underline-offset-2 hover:underline">Blog</a>
				</li>
			</ul>
		</section>
	</div>
</main>
