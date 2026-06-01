<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/client/auth.svelte.js';
	import QuestionCard from '$lib/components/question-card.svelte';
	import QuestionSelector from '$lib/components/question-selector.svelte';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Topbar from '$lib/components/topbar.svelte';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import { Badge } from '$lib/components/ui/badge/index.js';

	const showHowToUse = false;
	const howToSteps = [
		{
			number: '1',
			title: 'Plan your year',
			description: '— pick AP classes that fit your schedule and goals.'
		},
		{
			number: '2',
			title: 'Choose a subject',
			description: '— select the AP you’re taking or previewing this summer.'
		},
		{
			number: '3',
			title: 'Start with Unit 1',
			description: '— get ahead before the first day of class.'
		},
		{
			number: '4',
			title: 'Practice & learn',
			description: '— generate questions and read instant explanations.'
		}
	];

	let selectedClass = $state('');
	let selectedUnit = $state('');
	let customTopic = $state('');
	let generateVersion = $state(0);

	function handleSelectionChange(): void {
		generateVersion = 0;
	}

	function handleGenerate(): void {
		generateVersion += 1;
	}

	onMount(() => {
		auth.init();
		if (auth.isAuthenticated) {
			goto(resolve('/app'), { replaceState: true });
		}
	});
</script>

<svelte:head>
	<title>Free AP Practice – Plan APs, Study This Summer &amp; Ace Your Exams</title>
	<meta
		name="title"
		content="Free AP Practice – Summer AP Study, Course Planning &amp; Exam Prep"
	/>
	<meta
		name="description"
		content="Free AP practice for high school students: plan which APs to take, preview Unit 1 over the summer, and generate unlimited questions with instant feedback. No signup required."
	/>
	<meta
		name="keywords"
		content="summer AP study, AP course planning, first AP class, rising sophomore AP, AP practice questions, AP exam prep, free AP questions, AP study guide, preview AP class, high school summer study, AP question generator, how to choose AP classes"
	/>
	<meta name="author" content="FreeAPPractice.org" />
	<meta
		name="robots"
		content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
	/>
	<meta name="googlebot" content="index, follow" />
	<meta name="language" content="English" />
	<meta name="revisit-after" content="7 days" />
	<meta name="distribution" content="global" />
	<meta name="rating" content="general" />
	<meta name="geo.region" content="US" />
	<meta name="geo.placename" content="United States" />
	<meta name="format-detection" content="telephone=no" />
	<link rel="canonical" href="https://freeappractice.org/" />

	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/" />
	<meta
		property="og:title"
		content="Free AP Practice – Plan Your AP Year &amp; Study This Summer"
	/>
	<meta
		property="og:description"
		content="Plan which APs to take, preview Unit 1 this summer, and practice with unlimited free questions and instant feedback across 20+ AP subjects."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="FreeAPPractice.org - Free AP® Practice Questions Generator"
	/>
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/" />
	<meta name="twitter:title" content="Free AP Practice – Summer Study &amp; Exam Prep" />
	<meta
		name="twitter:description"
		content="Plan your AP classes, preview Unit 1 this summer, and practice free with instant feedback across 20+ subjects."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
	<meta
		name="twitter:image:alt"
		content="FreeAPPractice.org - Free AP® Practice Questions Generator"
	/>
	<meta name="twitter:creator" content="@freeappractice" />
	<meta name="twitter:site" content="@freeappractice" />
	<meta name="adsense-client" content="ca-pub-9609730506370011" />

	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "WebApplication",
			"name": "Free AP Practice",
			"alternateName": "Free AP Practice",
			"url": "https://freeappractice.org",
			"description": "Free AP practice for planning your AP year, summer Unit 1 preview, and exam prep across 20+ subjects with instant feedback",
			"logo": "https://freeappractice.org/icon.png",
			"image": "https://freeappractice.org/icon.png",
			"applicationCategory": "EducationalApplication",
			"aggregateRating": {
				"@type": "AggregateRating",
				"ratingValue": "4.8",
				"ratingCount": "1250",
				"bestRating": "5",
				"worstRating": "1"
			},
			"offers": {
				"@type": "Offer",
				"price": "0",
				"priceCurrency": "USD",
				"availability": "https://schema.org/InStock"
			},
			"browserRequirements": "Requires JavaScript",
			"operatingSystem": "Any",
			"softwareVersion": "1.3.0",
			"datePublished": "2025-12-12",
			"dateModified": "2026-3-31",
			"inLanguage": "en-US",
			"isAccessibleForFree": true,
			"educationalUse": [
				"Test Preparation",
				"Self Study",
				"Exam Review",
				"Course Planning",
				"Summer Study"
			],
			"educationalLevel": "High School",
			"learningResourceType": "Practice Quiz",
			"audience": {
				"@type": "EducationalAudience",
				"educationalRole": "student"
			},
			"creator": {
				"@type": "Person",
				"name": "Ajay Saravanan"
			},
			"publisher": {
				"@type": "Organization",
				"name": "FreeAPPractice.org",
				"logo": {
					"@type": "ImageObject",
					"url": "https://freeappractice.org/icon.png"
				}
			},
			"featureList": [
				"20+ AP Subjects Coverage",
				"AP Course Planning Guides",
				"Summer Unit 1 Preview",
				"Unlimited Question Generation",
				"Instant AI Feedback",
				"Detailed Explanations",
				"No Registration Required",
				"100% Free"
			],
			"about": {
				"@type": "Thing",
				"name": "AP® Exams",
				"description": "Advanced Placement® Examinations"
			}
		}
	</script>

	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "WebSite",
			"name": "Free AP Practice",
			"url": "https://freeappractice.org/"
		}
	</script>

	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "FAQPage",
			"mainEntity": [
				{
					"@type": "Question",
					"name": "What is this website?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "Free AP Practice helps high school students plan their AP year, preview courses over the summer, and prepare for AP exams with AI-generated practice questions and instant explanations."
					}
				},
				{
					"@type": "Question",
					"name": "How does it work?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "Select an AP class from the dropdown menu and click Generate Question. The AI will create a multiple-choice question with four options (A-D). After selecting your answer, you'll receive immediate feedback and a detailed explanation."
					}
				},
				{
					"@type": "Question",
					"name": "Is this free to use?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "Yes! This website is completely free to use. There are no subscriptions, no hidden fees, and no limits on how many questions you can generate."
					}
				},
				{
					"@type": "Question",
					"name": "Which AP subjects are covered?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "We cover 20+ AP subjects including Sciences (Biology, Chemistry, Physics 1/2/C), Mathematics (Calculus AB/BC, Statistics, Precalculus), Computer Science (A and Principles), English (Language and Literature), History (US, World, European), Social Sciences (Psychology, Human Geography, Government), and Economics (Macro and Micro)."
					}
				},
				{
					"@type": "Question",
					"name": "Do I need to create an account?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "No account creation required! You can start practicing AP questions immediately without any sign-up or registration process."
					}
				},
				{
					"@type": "Question",
					"name": "How accurate are the AI-generated questions?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "Our questions are generated using OpenAI's advanced gpt-5-mini reasoning model, specifically designed to create high-quality, exam-style AP questions that match the difficulty and format of actual AP exams."
					}
				},
				{
					"@type": "Question",
					"name": "Can I use this over the summer before my AP class starts?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "Yes. Many students use summer to preview Unit 1, build a daily practice habit, and plan which AP classes to take. See our Summer AP Study Guide for a realistic 4-week outline."
					}
				},
				{
					"@type": "Question",
					"name": "I'm not in an AP class yet—can I still practice here?",
					"acceptedAnswer": {
						"@type": "Answer",
						"text": "If you know which AP you might take next year, you can preview Unit 1 now. If you are still deciding, start with our guide on which APs to take before heavy practice."
					}
				}
			]
		}
	</script>

	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "Organization",
			"name": "Free AP Practice",
			"url": "https://freeappractice.org",
			"logo": "https://freeappractice.org/icon.png",
			"description": "Free AI-powered AP practice question generator for students",
			"founder": {
				"@type": "Person",
				"name": "Ajay Saravanan"
			},
			"foundingDate": "2025-12-12",
			"sameAs": [
				"https://www.instagram.com/freeappractice",
				"https://www.youtube.com/channel/UC8RyXwmKWUI7XLHCcEL16JA",
				"https://github.com/5cisummai/freeappractice"
			],
			"contactPoint": {
				"@type": "ContactPoint",
				"email": "support@freeappractice.org",
				"contactType": "Customer Support"
			}
		}
	</script>

	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "Course",
			"name": "AP Exam Preparation and Summer Preview",
			"description": "Course planning, summer Unit 1 preview, and practice questions for 20+ Advanced Placement subjects",
			"provider": {
				"@type": "Organization",
				"name": "Free AP Practice",
				"url": "https://freeappractice.org"
			},
			"educationalLevel": "High School",
			"coursePrerequisites": "None",
			"isAccessibleForFree": true,
			"hasCourseInstance": {
				"@type": "CourseInstance",
				"courseMode": "online",
				"courseWorkload": "PT"
			}
		}
	</script>
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main id="main-content" class="flex-1">
		<div class="mx-auto w-full max-w-7xl space-y-16 px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
			<section class="mx-auto max-w-5xl space-y-10 text-center" id="hero">
				<div class="mx-auto max-w-3xl space-y-4">
					<div
						class="flex flex-wrap justify-center gap-2 animate-in fade-in-0 slide-in-from-bottom-3 duration-500 fill-mode-both"
					>
						<Badge variant="ghost" href={resolve('/blog/which-aps-to-take')} class="p-2">
							Planning your AP year?
							<ArrowRightIcon class="size-4" />
						</Badge>
						<Badge variant="ghost" href={resolve('/summer')} class="p-2">
							Summer study guide
							<ArrowRightIcon class="size-4" />
						</Badge>
					</div>
					<h1
						class="animate-in fill-mode-both font-display text-4xl leading-[1.12] font-medium tracking-tight text-balance fade-in-0 slide-in-from-bottom-4 duration-700 delay-150 sm:text-4xl lg:text-5xl"
					>
						Plan your AP year. Get ahead this summer.
					</h1>
					<p
						class="text-md mx-auto max-w-3xl animate-in leading-8 text-balance text-muted-foreground fade-in-0 slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both sm:text-lg"
					>
						Start your AP journey with free practice questions and instant feedback.
					</p>

					<div class="flex flex-wrap justify-center gap-3 text-base">
						<span
							class="animate-in rounded-full border border-border/70 bg-muted/40 px-4 py-1.5 fade-in-0 slide-in-from-bottom-2 duration-500 delay-500 fill-mode-both"
							>Student Developed</span
						>
						<span
							class="animate-in rounded-full border border-border/70 bg-muted/40 px-4 py-1.5 fade-in-0 slide-in-from-bottom-2 duration-500 delay-600 fill-mode-both"
							>20+ AP Subjects</span
						>
						<span
							class="animate-in rounded-full border border-border/70 bg-muted/40 px-4 py-1.5 fade-in-0 slide-in-from-bottom-2 duration-500 delay-700 fill-mode-both"
							>100% Free</span
						>
					</div>
				</div>

				{#if showHowToUse}
					<div class="space-y-6">
						<h2 class="text-3xl font-semibold">How to Use</h2>
						<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{#each howToSteps as step (step.number)}
								<div
									class="step flex h-full flex-col rounded-2xl border border-border/70 bg-background/80 p-5 text-left shadow-sm"
								>
									<div class="mb-3 flex items-center justify-center text-2xl font-semibold">
										{step.number}
									</div>
									<p class="text-base leading-7">
										<strong>{step.title}</strong>
										{step.description}
									</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</section>

			<section>
				<div class="mx-auto max-w-5xl">
					<QuestionSelector
						bind:selectedClass
						bind:selectedUnit
						bind:customTopic
						hideQuestionTypeTabs={true}
						isLoading={false}
						onSelectionChange={handleSelectionChange}
						onGenerate={handleGenerate}
					/>
				</div>
			</section>

			<section>
				<div class="mx-auto min-h-10 max-w-6xl">
					{#if generateVersion > 0}
						{#key `${selectedClass}:${selectedUnit}:${customTopic}:${generateVersion}`}
							<QuestionCard
								subject={selectedClass || 'Select AP Class'}
								{selectedClass}
								{selectedUnit}
								{customTopic}
								requestVersion={generateVersion}
							/>
						{/key}
					{/if}
				</div>
			</section>

			<section
				class="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 rounded-2xl border border-border/70 bg-card px-6 py-8 text-center"
			>
				<h2 class="text-xl font-semibold tracking-tight">New to AP or studying this summer?</h2>
				<p class="max-w-lg text-sm leading-relaxed text-muted-foreground">
					See our step-by-step summer guide; plan your classes, preview Unit 1, and practice about
					20 minutes a day.
				</p>
				<Badge variant="ghost" href={resolve('/summer')} class="p-2">
					Summer AP study guide
					<ArrowRightIcon class="size-4" />
				</Badge>
			</section>

			<section class="mx-auto w-full max-w-3xl space-y-4">
				<div class="space-y-1">
					<h2 class="text-2xl font-semibold tracking-tight">FAQ</h2>
				</div>

				<Accordion.Root type="single" class="rounded-xl border border-border/70 bg-card px-4">
					<Accordion.Item value="what-is-this-website">
						<Accordion.Trigger level={3}>What is this website?</Accordion.Trigger>
						<Accordion.Content>
							<p>
								Free AP Practice helps high school students plan which AP classes to take, preview
								courses over the summer, and prepare for AP exams. Generate unlimited practice
								questions with instant explanations across 20+ subjects—no signup required.
							</p>
						</Accordion.Content>
					</Accordion.Item>

					<Accordion.Item value="which-subjects-supported">
						<Accordion.Trigger level={3}>Which AP® subjects are supported?</Accordion.Trigger>
						<Accordion.Content>
							<p>
								We support 20 AP® subjects including Sciences (Biology, Chemistry, Physics),
								Mathematics (Calculus AB/BC, Statistics), Computer Science, English, History, Social
								Sciences, and Economics.
							</p>
						</Accordion.Content>
					</Accordion.Item>

					<Accordion.Item value="how-does-it-work">
						<Accordion.Trigger level={3}>How does it work?</Accordion.Trigger>
						<Accordion.Content>
							<p>
								Select an AP class from the dropdown menu and click "Generate Question". The AI will
								create a multiple-choice question with four options (A-D). After selecting your
								answer, you'll receive immediate feedback and a detailed explanation.
							</p>
						</Accordion.Content>
					</Accordion.Item>

					<Accordion.Item value="summer-study">
						<Accordion.Trigger level={3}>Can I use this over the summer?</Accordion.Trigger>
						<Accordion.Content>
							<p>
								Yes. Summer is ideal for previewing Unit 1 and building a short daily habit before
								school starts. See our
								<a href={resolve('/summer')} class="underline underline-offset-2"
									>Summer AP Study Guide</a
								>
								and
								<a href={resolve('/blog/summer-ap-study-plan')} class="underline underline-offset-2"
									>4-week study plan</a
								>
								for pacing that avoids burnout.
							</p>
						</Accordion.Content>
					</Accordion.Item>

					<Accordion.Item value="not-in-ap-yet">
						<Accordion.Trigger level={3}
							>I'm not in an AP class yet. Can I still use this?</Accordion.Trigger
						>
						<Accordion.Content>
							<p>
								If you know which AP you might take next year, start with Unit 1 to get familiar
								with the material. If you're still deciding, read our guide on
								<a href={resolve('/blog/which-aps-to-take')} class="underline underline-offset-2"
									>which APs to take</a
								>
								before heavy practice.
							</p>
						</Accordion.Content>
					</Accordion.Item>

					<Accordion.Item value="is-this-free-to-use">
						<Accordion.Trigger level={3}>Is this free to use?</Accordion.Trigger>
						<Accordion.Content>
							<p>
								Yes! This website is completely free to use. There are no subscriptions, no hidden
								fees, and no limits on how many questions you can generate.
							</p>
						</Accordion.Content>
					</Accordion.Item>

					<Accordion.Item value="why-do-questions-take-long">
						<Accordion.Trigger level={3}
							>Why do the questions take a long time to load?</Accordion.Trigger
						>
						<Accordion.Content>
							<p>
								Question may take longer to load as you may be generating a question for the
								specific unit and topic for the first time. This then helps helps everyone by adding
								new questions to the cache, which then provides sub second load times the next time.
								This is only expected to be a problem for newer users in the first few weeks, and
								will be resolved as more questions are generated and added to the cache.
							</p>
						</Accordion.Content>
					</Accordion.Item>
				</Accordion.Root>
			</section>
		</div>
	</main>

	<SiteFooter />
</div>
