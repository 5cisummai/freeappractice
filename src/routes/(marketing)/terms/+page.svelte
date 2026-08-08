<script lang="ts">
	import PublicPageHero from '$lib/components/marketing/public-page-hero.svelte';
	import BackToHome from '$lib/components/layout/back-to-home.svelte';
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head>
	<title>Terms of Service – Free AP Practice</title>
	<meta name="description" content="Terms of Service for Free AP Practice" />
	<meta name="author" content="FreeAPPractice.org" />
	<meta name="robots" content="index, follow" />
	<link rel="canonical" href="https://freeappractice.org/terms" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/terms" />
	<meta property="og:title" content="Terms of Service – Free AP Practice" />
	<meta property="og:description" content="Terms of Service for Free AP Practice" />
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/terms" />
	<meta name="twitter:title" content="Terms of Service – Free AP Practice" />
	<meta name="twitter:description" content="Terms of Service for Free AP Practice" />
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<main id="main-content" class="flex-1 py-12">
	<div class="mx-auto w-full max-w-3xl space-y-8 px-5 sm:px-8">
		<BackToHome />

		<PublicPageHero
			title="Terms of Service"
			description="The rules and guidelines for using Free AP Practice."
			meta="Last Updated: August 5, 2026"
		/>

		<div class="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-base leading-7">
			<section>
				<h2 class="text-xl font-semibold">1. Agreement to Terms</h2>
				<p>
					By accessing or using Free AP Practice (the "Service", "we", "us", or "our"), you agree to
					these Terms of Service and our Privacy Policy. Free AP Practice is a personal project
					maintained by Ajay Saravanan. If you do not agree, do not use the Service. These Terms are
					effective as of the date shown above.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">2. Accounts and Eligibility</h2>
				<p>
					Some features require an account, including progress syncing, bookmarks, saved settings,
					history across devices, Insights, Coach, study plans, and Super. You must provide accurate
					information, keep your login credentials secure, and notify us if you believe your account
					has been compromised. You are responsible for activity that occurs under your account. You
					must be at least 13 years old to create or use an account. If you are under 13, do not
					create an account or submit personal information.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">3. Use License</h2>
				<p>
					We grant you a limited, revocable, non-exclusive license to use the Service for personal,
					non-commercial study purposes only. This license does not transfer ownership of the
					Service or its content.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">4. Free Service</h2>
				<p>
					The Service includes free practice questions, explanations, progress features,
					written-response practice, and the standard AI tutor. Free features may be changed,
					limited, suspended, or removed at any time. We do not guarantee that any question,
					explanation, grade, or feature will be available without interruption or error.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">5. Super Membership</h2>
				{#if data.superFreeBetaEnabled}
					<p>
						During the Super free beta, authenticated students aged 13 or older can claim free
						access to personalized multiple-choice and written-response tutoring, Coach, Insights,
						weekly study plans, and up to 300 personalized messages per UTC calendar month.
					</p>
				{:else}
					<p>
						Super is an optional subscription for students aged 13 or older. It is offered at $9 per
						month or $79 per year, plus applicable tax, and renews automatically until you cancel.
						Super includes personalized multiple-choice and written-response tutoring, Coach,
						Insights, weekly study plans, and up to 600 personalized messages per UTC calendar
						month. We do not offer a free trial, promotional pricing, discounts, or usage overages
						for Super unless the checkout page expressly says otherwise.
					</p>
					<p class="mt-2">
						You can cancel or restore a cancellation before the current billing period ends in the
						billing portal. A cancellation takes effect at the end of the paid period. Any permitted
						billing-interval change takes effect at the next renewal. Failed or past-due payments
						may limit or end access after the applicable grace period. Payments, taxes, receipts,
						and the billing portal are provided by Stripe. Any refund rights are governed by
						applicable law and the disclosures made at checkout.
					</p>
				{/if}
			</section>

			<section>
				<h2 class="text-xl font-semibold">6. User Content and Rights</h2>
				<p>
					Content you submit, including profile information, answers, bookmarks, feedback, bug
					reports, written-response submissions, and account-related requests, remains yours. By
					submitting content, you grant us a non-exclusive license to host, process, store, display,
					analyze, and send that content to the providers described in our
					<a href={resolve('/privacy')} class="underline underline-offset-4">Privacy Policy</a>
					as reasonably necessary to operate, maintain, secure, and improve the Service.
				</p>
				<p class="mt-2">
					Do not submit passwords, payment-card information, government identifiers, health
					information, private information about another person, or other sensitive information to
					the AI tools or bug-report form. Bug reports may be forwarded to GitHub Issues and may be
					publicly visible, including the optional email address and technical question context you
					provide. Use support@freeappractice.org for a private support request.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">7. AI-Generated Content and Personalization</h2>
				<p>
					The Service uses OpenAI or an OpenAI-compatible provider to generate practice questions,
					explanations, written-response grades, tutoring content, Coach suggestions, Insights, and
					study plans. AI-generated content can be incomplete, incorrect, biased, or misleading. AI
					grades are practice feedback, not official AP scores or professional advice. Review
					important information and use your own judgment. Super Insights summarize recorded study
					evidence; they do not predict AP exam scores or guarantee academic outcomes. Coach
					suggestions and study-plan changes are provided for study organization, not as a guarantee
					of performance.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">8. Acceptable Use</h2>
				<p>
					You agree not to misuse the Service. Prohibited activities include harassment, illegal
					activity, distributing malware, attempting unauthorized access, scraping data at scale,
					circumventing security controls, reverse engineering protected parts of the Service, or
					using the Service to generate harmful, abusive, or disallowed content. You may not use the
					Service to extract another person’s data, evade rate limits or usage limits, interfere
					with billing or access controls, or submit content you do not have the right to submit.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">9. Third-Party Services</h2>
				<p>
					The Service depends on third-party providers, including OpenAI for AI operations, Google
					for sign-in and Google One Tap, Neon-hosted PostgreSQL for database storage, AWS S3 for
					file storage, Desmos for calculator functionality, Resend for transactional emails,
					PostHog for optional product analytics, Vercel for hosting and infrastructure, Sentry for
					error and performance monitoring, Stripe for payments and taxes, Mem0 for optional tutor
					memory, Upstash for short-lived service controls, and GitHub for bug-report handling.
					Those providers may process data according to their own terms and privacy policies. We are
					not responsible for third-party services that we do not control.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">10. Independent Service and Intellectual Property</h2>
				<p>
					Free AP Practice is an independent service and is not affiliated with, endorsed by, or
					sponsored by College Board. AP and related course names may be trademarks of their
					respective owners. We do not claim ownership of third-party marks or official examination
					materials. You may not copy, redistribute, scrape, or use the Service’s questions,
					explanations, code, branding, or other content except as allowed by these Terms or
					applicable law.
				</p>
				<p class="mt-2">
					If you believe content on the Service infringes your rights, contact
					<a href="mailto:support@freeappractice.org" class="underline underline-offset-4"
						>support@freeappractice.org</a
					>
					with enough information for us to review the concern.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">11. Disclaimers and Limitations</h2>
				<p>
					The Service and all content are provided "as is" and "as available" without warranties of
					any kind, express or implied. To the maximum extent permitted by law, we disclaim
					liability for indirect, incidental, special, consequential, or punitive damages arising
					from your use of the Service. We do not warrant uninterrupted availability, accuracy,
					security, fitness for a particular purpose, or academic results. Nothing in these Terms
					excludes a liability or right that cannot lawfully be excluded or limited.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">12. Termination and Deletion</h2>
				<p>
					We may suspend or terminate access to the Service at any time for violations of these
					Terms, security concerns, or operational reasons. You may delete your account through the
					Service or by contacting us. Deletion removes the account record from our primary database
					and initiates removal of app-owned profile, practice, personalization, referral,
					billing-mirror, Insight, study-plan, feedback, audit, and tutor-memory data. Some
					information may remain in backups, logs, billing records, or third-party systems for a
					limited time, and public GitHub issues may not be removable by us.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">13. Governing Law and Disputes</h2>
				<p>
					These Terms are governed by the laws applicable in the United States, without regard to
					conflict-of-law principles. Any dispute will be handled in a lawful forum with competent
					jurisdiction unless the parties agree otherwise in writing.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">14. Changes to Terms</h2>
				<p>
					We may update these Terms from time to time. The updated version will be posted on this
					page with a revised "Last Updated" date. Where required, we will provide additional
					notice. Continued use of the Service after changes take effect means you accept the
					revised Terms.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">15. Contact Information</h2>
				<p>
					If you have questions about these Terms, contact us at:<br />
					Operator: <strong>Ajay Saravanan</strong><br />
					Website: <strong>freeappractice.org</strong><br />
					Email:
					<a href="mailto:support@freeappractice.org" class="underline underline-offset-4"
						>support@freeappractice.org</a
					>
				</p>
			</section>
		</div>
	</div>
</main>
