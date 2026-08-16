<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { authClient } from '$lib/auth/client.js';
	import { captureLandingPageViewed } from '$lib/client/activation-analytics';
	import PracticeRunner from '$lib/components/practice/practice-shell.svelte';
	import { twAnimateInView } from '$lib/tw-animate';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import AspiringStudentsSection from '$lib/components/marketing/aspiring-students-section.svelte';
	import BottomCtaSection from '$lib/components/marketing/bottom-cta-section.svelte';
	import LandingHero from '$lib/components/marketing/landing-hero.svelte';
	import UnlimitedSection from '$lib/components/marketing/unlimited-section.svelte';
	import SuperSection from '$lib/components/marketing/super-section.svelte';
	import PricingSection from '$lib/components/marketing/pricing-section.svelte';
	import PublicShell from '$lib/components/layout/public-shell.svelte';

	let { data } = $props();

	let selectedClass = $state('AP World History');
	let selectedUnit = $state('Unit 1: The Global Tapestry');
	let unitRange = $state<number[] | undefined>(undefined);
	let requestVersion = $state(0);

	type HomeFaqItem = { id: string; question: string; answer: string };

	const homeFaqItems = $derived.by((): HomeFaqItem[] => {
		const items: HomeFaqItem[] = [
			{
				id: 'what-is-this-website',
				question: 'What is this website?',
				answer:
					'Free AP Practice is the fastest way to practice AP online: pick a subject, click generate, and start answering questions in 2 clicks—no signup, free, with instant AI feedback across 20+ subjects.'
			},
			{
				id: 'how-does-it-work',
				question: 'How does it work?',
				answer:
					'Select an AP class from the dropdown and click Generate Question. You get an exam-style multiple-choice question with four options (A–D). After you answer, you get immediate feedback and a detailed explanation.'
			},
			{
				id: 'which-subjects-supported',
				question: 'Which AP subjects are covered?',
				answer:
					'We cover 20+ AP subjects including Sciences (Biology, Chemistry, Physics 1/2/C), Mathematics (Calculus AB/BC, Statistics, Precalculus), Computer Science (A and Principles), English (Language and Literature), History (US, World, European), Social Sciences (Psychology, Human Geography, Government), and Economics (Macro and Micro).'
			},
			{
				id: 'how-accurate',
				question: 'How accurate are the AI-generated questions?',
				answer:
					'Questions are generated to match AP exam style and difficulty so you can practice the format you will see in class and on the exam. They are for practice and feedback, not a replacement for official College Board materials.'
			},
			{
				id: 'school-starting',
				question: 'School just started. How should I use this with my AP classes?',
				answer:
					'Use it to keep up with class, not to cram the whole exam. After a lecture or unit, generate a few questions in that unit so the next class starts with the gaps already visible.'
			},
			{
				id: 'choosing-classes',
				question: 'I am still choosing which AP classes to take. Can I still use this?',
				answer:
					'Yes. Sample Unit 1 in a couple of subjects to see which courses feel like a fit before you lock your schedule. If you want a starting point, read our guide on which APs to take before heavy practice.'
			},
			{
				id: 'what-does-super-include',
				question: 'What does Super include?',
				answer: data.superFreeBetaEnabled
					? 'During the free beta, you can claim Super for personalized MCQ and FRQ tutoring, AI Coach, actionable insights, weekly study plans, and 300 personalized messages per month.'
					: 'Super includes personalized MCQ and FRQ tutoring, AI Coach, actionable insights, weekly study plans, and 600 personalized messages per month. Free AP practice remains available without a Super subscription.'
			}
		];
		if (!data.superFreeBetaEnabled) {
			items.push({
				id: 'how-much-does-super-cost',
				question: 'How much does Super cost?',
				answer:
					'Super costs $9 per month or $79 per year, plus applicable tax. It renews automatically until canceled, and free AP practice is still available without a subscription.'
			});
		}
		return items;
	});
	const homeFaqJsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: homeFaqItems.map((item) => ({
				'@type': 'Question',
				name: item.question,
				acceptedAnswer: { '@type': 'Answer', text: item.answer }
			}))
		})
	);
	const homeFaqJsonLdMarkup = $derived(
		'<script type="application/ld+json">' + homeFaqJsonLd + '</' + 'script>'
	);

	onMount(() => {
		captureLandingPageViewed();
		void authClient.getSession().then(({ data }) => {
			if (data?.session) {
				void goto(resolve('/app'));
			}
		});
	});
</script>

<svelte:head>
	<title>Free AP Practice | The Fastest Way to Practice AP Online</title>
	<meta name="title" content="Free AP Practice | The Fastest Way to Practice AP Online" />
	<meta
		name="description"
		content="The fastest free AP practice on the internet: pick a subject, click generate, and start practicing in 2 clicks. Unlimited questions with instant feedback—no signup, no paywall."
	/>
	<meta
		name="keywords"
		content="fastest AP practice, AP practice no signup, instant AP questions, 2 click AP practice, free AP question generator, unlimited AP questions, AP exam prep, no account AP study, AP practice online, free AP questions"
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
	<meta property="og:title" content="Free AP Practice | Start Practicing in 2 Clicks" />
	<meta
		property="og:description"
		content="The fastest way to practice AP online: pick a subject, generate a question, get instant feedback. Free, unlimited, no signup across 20+ subjects."
	/>
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="FreeAPPractice.org – fastest free AP practice, 2 clicks to start"
	/>
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/" />
	<meta name="twitter:title" content="Free AP Practice | 2 Clicks, No Signup" />
	<meta
		name="twitter:description"
		content="Fastest free AP practice online: pick a subject, click generate, get instant feedback. Unlimited questions across 20+ subjects."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
	<meta
		name="twitter:image:alt"
		content="FreeAPPractice.org – fastest free AP practice, 2 clicks to start"
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
			"description": "The fastest free AP practice online—start in 2 clicks with no signup. Unlimited AI-generated questions and instant feedback across 20+ subjects.",
			"logo": "https://freeappractice.org/icon.png",
			"image": "https://freeappractice.org/icon.png",
			"applicationCategory": "EducationalApplication",
			"offers": {
				"@type": "Offer",
				"price": "0",
				"priceCurrency": "USD",
				"availability": "https://schema.org/InStock"
			},
			"browserRequirements": "Requires JavaScript",
			"operatingSystem": "Any",
			"softwareVersion": "1.6.9",
			"datePublished": "2025-12-12",
			"dateModified": "2026-08-14",
			"inLanguage": "en-US",
			"isAccessibleForFree": true,
			"educationalUse": [
				"Test Preparation",
				"Self Study",
				"Exam Review",
				"Course Planning",
				"Classroom Support"
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
				"Practice in 2 Clicks",
				"No Registration Required",
				"Fastest Path to AP Questions",
				"Unlimited Question Generation",
				"Instant AI Feedback",
				"20+ AP Subjects Coverage",
				"Detailed Explanations",
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

	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html homeFaqJsonLdMarkup}

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
			"description": "Keep up with AP classes from the first weeks of school with practice questions for 20+ Advanced Placement subjects",
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

<PublicShell showPricing={!data.superFreeBetaEnabled}>
	<main id="main-content" class="flex-1">
		<LandingHero freeBeta={data.superFreeBetaEnabled}>
			<section
				id="practice"
				class="relative z-10 w-full max-sm:mr-[calc(50%-50vw)] max-sm:ml-[calc(50%-50vw)] max-sm:w-screen"
			>
				<div class="rounded-3xl shadow-lg">
					<div
						class="relative overflow-hidden rounded-3xl border border-border/60 bg-background/70 py-4 backdrop-blur-sm max-sm:px-0 sm:p-6 dark:bg-background/75 dark:backdrop-blur-lg dark:shadow-primary/10"
					>
						<div
							class="absolute top-3 left-4 hidden items-center gap-2 sm:top-4 sm:left-5 sm:flex"
							aria-hidden="true"
						>
							<span class="size-3 rounded-full bg-[#ff5f57]"></span>
							<span class="size-3 rounded-full bg-[#febc2e]"></span>
							<span class="size-3 rounded-full bg-[#28c840]"></span>
						</div>
						<PracticeRunner
							initial={{ selectedClass, selectedUnit, unitRange, requestVersion }}
							capabilities={{ tutorMode: data.assistantFeaturesEnabled ? 'free' : 'hidden' }}
							quiz={{ persistHistory: false }}
							presentation="hero"
							onEvent={(event) => {
								if (event.type === 'selection-change') {
									selectedClass = event.selectedClass;
									selectedUnit = event.selectedUnit;
								}
							}}
						/>
					</div>
				</div>
			</section>
		</LandingHero>

		<div
			class="mx-auto w-full max-w-7xl space-y-20 px-5 pt-24 pb-12 sm:px-8 lg:space-y-24 lg:px-10 lg:pt-32 lg:pb-16"
		>
			<UnlimitedSection showTutor={data.assistantFeaturesEnabled} />

			<SuperSection />

			<AspiringStudentsSection />

			{#if !data.superFreeBetaEnabled}
				<PricingSection />
			{/if}

			<section class="mx-auto w-full max-w-3xl space-y-4 {twAnimateInView}">
				<div class="space-y-1">
					<h2 class="text-2xl font-semibold tracking-tight">FAQ</h2>
				</div>

				<Accordion.Root
					type="single"
					class="rounded-xl border border-border/70 bg-card px-4 transition-shadow duration-300 hover:shadow-sm"
				>
					{#each homeFaqItems as item (item.id)}
						<Accordion.Item value={item.id}>
							<Accordion.Trigger level={3}>{item.question}</Accordion.Trigger>
							<Accordion.Content>
								<p>{item.answer}</p>
							</Accordion.Content>
						</Accordion.Item>
					{/each}
				</Accordion.Root>
			</section>

			<BottomCtaSection />
		</div>
	</main>
</PublicShell>
