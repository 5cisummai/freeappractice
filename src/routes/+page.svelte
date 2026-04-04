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

	function observeElement(element: Element) {
		const onAnimationEnd = () => {
			element.classList.add('fade-in-done');
		};
		element.addEventListener('animationend', onAnimationEnd, { once: true });

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add('fade-in-visible');
						observer.unobserve(entry.target);
					}
				});
			},
			{ threshold: 0.1, rootMargin: '0px 0px -100px 0px' }
		);

		observer.observe(element);

		return {
			destroy() {
				observer.disconnect();
				element.removeEventListener('animationend', onAnimationEnd);
			}
		};
	}

	const showHowToUse = false;
	const howToSteps = [
		{ number: '1', title: 'Select a Course', description: 'Choose your AP subject' },
		{ number: '2', title: 'Pick a Unit', description: 'Select a unit' },
		{ number: '3', title: 'Generate Question', description: 'Create a practice question' },
		{ number: '4', title: 'Answer & Learn', description: 'Get instant feedback' }
	];

	let selectedClass = $state('');
	let selectedUnit = $state('');
	let generateVersion = $state(0);

	const AP_EXAM_START = new Date(2026, 4, 4);

	function getDaysUntilExamStart(): number {
		const today = new Date();
		const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		const startOfExam = new Date(
			AP_EXAM_START.getFullYear(),
			AP_EXAM_START.getMonth(),
			AP_EXAM_START.getDate()
		);
		const diffMs = startOfExam.getTime() - startOfToday.getTime();
		return Math.max(0, Math.floor(diffMs / 86_400_000));
	}

	const daysUntilExamStart = getDaysUntilExamStart();
	const countdownStartValue = daysUntilExamStart + 1;
	const countdownDigitsLength = Math.max(
		String(daysUntilExamStart).length,
		String(countdownStartValue).length
	);
	const countdownStartDigits = String(countdownStartValue).padStart(countdownDigitsLength, ' ').split('');
	const countdownEndDigits = String(daysUntilExamStart).padStart(countdownDigitsLength, ' ').split('');

	let countdownRolled = $state(false);

	function displayDigit(digit: string): string {
		return digit === ' ' ? '\u00A0' : digit;
	}

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
		const timer = window.setTimeout(() => {
			countdownRolled = true;
		}, 150);

		return () => window.clearTimeout(timer);
	});
</script>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	:global(.fade-in-section) {
		opacity: 0;
		transform: translateY(20px);
	}

	:global(.fade-in-section.fade-in-visible) {
		animation: fadeIn 0.6s ease-out forwards;
	}

	:global(.fade-in-section.fade-in-done) {
		opacity: 1;
		transform: none;
		animation: none;
	}

		.countdown-roller {
			display: inline-flex;
			align-items: flex-start;
			gap: 0.04em;
			line-height: 1;
		}

		.countdown-digit-window {
			display: inline-flex;
			height: 1em;
			width: 0.68em;
			overflow: hidden;
			vertical-align: top;
		}

		.countdown-digit-strip {
			display: flex;
			flex-direction: column;
			line-height: 1;
			transform: translateY(0);
		}

		.countdown-digit-strip.roll-down {
			animation: countdownRollDown 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
		}

		.countdown-digit {
			display: flex;
			align-items: center;
			justify-content: center;
			height: 1em;
			line-height: 1;
			font-variant-numeric: tabular-nums;
		}

		@keyframes countdownRollDown {
			to {
				transform: translateY(-1em);
			}
		}
</style>

<svelte:head>
	<title>Free AP Practice Questions 2026 - AI-Powered AP Exam Prep</title>
	<meta
		name="title"
		content="Free AP Practice Questions 2026 - AI-Powered AP Exam Prep for All 20+ AP Classes"
	/>
	<meta
		name="description"
		content="Freeappractice.org provides free AI-generated AP practice questions, instant feedback, streak tracking, customizable units, and a privacy-first study experience."
	/>
	<meta
		name="keywords"
		content="AP practice questions, AP exam prep, AP test prep, free AP questions, AP study guide, AP Biology, AP Chemistry, AP Physics, AP Calculus AB, AP Calculus BC, AP Computer Science A, AP Computer Science Principles, AP History, AP US History, AP World History, AP English Language, AP English Literature, college board AP, AP practice test, AP exam 2026, free AP study material, AP multiple choice questions, AP test practice online, AP review questions, AP mock exam, how to study for AP exams, best AP prep, AP question generator, AI study tool, free AP test prep, AP exam study tips"
	/>
	<meta name="author" content="FreeAPPractice.org" />
	<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
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
	<meta property="og:title" content="Free AP® Practice Questions Generator | AP® Exam Prep 2026" />
	<meta
		property="og:description"
		content="Generate unlimited free AP® practice questions with instant AI feedback. Master all 20+ AP® subjects including Biology, Chemistry, Physics, Calculus, Computer Science, and History. No sign-up required."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="FreeAPPractice.org - Free AP® Practice Questions Generator" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/" />
	<meta name="twitter:title" content="Free AP® Practice Questions Generator | AP® Exam Prep 2026" />
	<meta
		name="twitter:description"
		content="Generate unlimited free AP® practice questions with instant AI feedback. Master all 20+ AP® subjects. No sign-up required."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
	<meta name="twitter:image:alt" content="FreeAPPractice.org - Free AP® Practice Questions Generator" />
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
			"description": "Free AP® practice question generator covering 20+ Advanced Placement subjects with instant feedback and detailed explanations",
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
			"educationalUse": ["Test Preparation", "Self Study", "Exam Review"],
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
						"text": "This is a free AP practice question generator that utilizes AI to create multiple-choice questions for various AP subjects. It helps students prepare for their AP exams with unlimited practice questions."
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
			"name": "AP Exam Preparation",
			"description": "Comprehensive practice questions for 20+ Advanced Placement subjects",
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

	<main class="flex-1">
		<div class="mx-auto w-full max-w-7xl space-y-16 px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
			<section class="fade-in-section how-to-use mx-auto max-w-5xl space-y-10 text-center" use:observeElement>
				<div class="space-y-4">
					<h1 class="text-4xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
						Ace your AP Exams
					</h1>
					<p class="text-md mx-auto max-w-3xl leading-8 text-muted-foreground sm:text-lg">
						Generate and practice High Quality AP questions with instant feedback
					</p>
					<div class="mx-auto inline-flex flex-nowrap items-center gap-2 whitespace-nowrap rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium">
						<span class="text-muted-foreground">AP exams start May 4, 2026</span>
						<span aria-hidden="true" class="text-muted-foreground">•</span>
						<span class="inline-flex items-center whitespace-nowrap tabular-nums text-foreground">
							<span class="countdown-roller" aria-label={`${daysUntilExamStart} ${daysUntilExamStart === 1 ? 'day' : 'days'} left`}>
								{#each countdownEndDigits as endDigit, index (index)}
									{@const startDigit = countdownStartDigits[index]}
									<span class="countdown-digit-window" aria-hidden="true">
										{#if countdownRolled}
											{#if startDigit !== endDigit}
												<span class="countdown-digit-strip roll-down">
													<span class="countdown-digit">{displayDigit(startDigit)}</span>
													<span class="countdown-digit">{displayDigit(endDigit)}</span>
												</span>
											{:else}
												<span class="countdown-digit">{displayDigit(endDigit)}</span>
											{/if}
										{:else}
											<span class="countdown-digit">{displayDigit(startDigit)}</span>
										{/if}
									</span>
								{/each}
							</span>
							<span class="ml-1">{daysUntilExamStart === 1 ? 'day' : 'days'} left</span>
						</span>
					</div>
					<div class="flex flex-wrap justify-center gap-3 text-base">
						<span class="rounded-full border border-border/70 bg-muted/40 px-4 py-1.5"
							>20+ AP Subjects</span
						>
						<span class="rounded-full border border-border/70 bg-muted/40 px-4 py-1.5"
							>100% Free Forever</span
						>
						<span class="rounded-full border border-border/70 bg-muted/40 px-4 py-1.5"
							>Student Developed</span
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
				<div class="fade-in-section mx-auto max-w-5xl" use:observeElement>
					<QuestionSelector
						bind:selectedClass
						bind:selectedUnit
						hideQuestionTypeTabs={true}
						isLoading={false}
						onSelectionChange={handleSelectionChange}
						onGenerate={handleGenerate}
					/>
				</div>
			</section>

			<section>
				<div class="fade-in-section mx-auto max-w-6xl min-h-10" use:observeElement>
					{#if generateVersion > 0}
						<QuestionCard
							subject={selectedClass || 'Select AP Class'}
							{selectedClass}
							{selectedUnit}
							requestVersion={generateVersion}
						/>
					{/if}
				</div>
			</section>

			<section class="fade-in-section mx-auto w-full max-w-3xl space-y-4" use:observeElement>
				<div class="space-y-1">
					<h2 class="text-2xl font-semibold tracking-tight">FAQ</h2>
				</div>

				<Accordion.Root type="single" class="rounded-xl border border-border/70 bg-card px-4">
					<Accordion.Item value="what-is-this-website">
						<Accordion.Trigger level={3}>What is this website?</Accordion.Trigger>
						<Accordion.Content>
							<p>
								This is a free AP practice question generator that uses AI to create multiple-choice
								questions for various AP subjects. It helps students prepare for their AP exams with
								unlimited practice questions.
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
								Question may take longer to load when new options are chosen due to the AI
								processing time required to generate customized questions. This site uses OpenAI's
								reasoning model gpt-5-mini to generate high quality questions and provide accurate
								feedback. After that, subsequent questions load faster thanks to caching, until new
								options are selected.
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
				</Accordion.Root>
			</section>
		</div>
	</main>

	<SiteFooter />
</div>