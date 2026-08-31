<script lang="ts">
	import PublicPageHero from '$lib/components/marketing/public-page-hero.svelte';
	import BackToHome from '$lib/components/layout/back-to-home.svelte';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Privacy Policy | Free AP Practice</title>
	<meta name="description" content="Privacy Policy for Free AP Practice" />
	<meta name="author" content="FreeAPPractice.org" />
	<meta name="robots" content="index, follow" />
	<link rel="canonical" href="https://freeappractice.org/privacy" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/privacy" />
	<meta property="og:title" content="Privacy Policy | Free AP Practice" />
	<meta property="og:description" content="Privacy Policy for Free AP Practice" />
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/privacy" />
	<meta name="twitter:title" content="Privacy Policy | Free AP Practice" />
	<meta name="twitter:description" content="Privacy Policy for Free AP Practice" />
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<main id="main-content" class="flex-1 py-12">
	<div class="mx-auto w-full max-w-3xl space-y-8 px-5 sm:px-8">
		<BackToHome />

		<PublicPageHero
			title="Privacy Policy"
			description="How we collect, use, and protect your information when you use Free AP Practice."
			meta="Last Updated: August 11, 2026"
		/>

		<div class="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-base leading-7">
			<section>
				<h2 class="text-xl font-semibold">1. Introduction</h2>
				<p>
					This Privacy Policy explains how Free AP Practice ("Service", "we", "us", or "our")
					collects, uses, stores, and shares information when you use the website, account features,
					practice tools, AI tutor, and Super features. Free AP Practice is a personal project
					maintained by Ajay Saravanan. This policy does not replace the privacy policies of the
					third-party services described below.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">2. Information We Collect</h2>
				<h3 class="text-lg font-medium">2.1 Information You Provide Directly</h3>
				<ul class="list-disc space-y-1 pl-6">
					<li>
						<strong>Account and sign-in data:</strong> name, email address, password hash, account timestamps,
						and identifiers supplied through Google sign-in. OAuth tokens are stored by the authentication
						system in encrypted form when needed for account linking.
					</li>
					<li>
						<strong>Practice data:</strong> AP class and unit selections, answers, correctness, timing,
						hints and attempt outcomes, progress, history, bookmarks, written-response submissions, and
						grades.
					</li>
					<li>
						<strong>Personalization data:</strong> selected classes, target dates, study availability,
						teaching-style preference, age-confirmation timestamp, memory preference, and memory disclosure
						acknowledgement.
					</li>
					<li>
						<strong>AI interactions:</strong> prompts, written responses, conversation context, and feedback
						you send to the standard tutor, personalized tutor, Coach, or other AI features. Coach may
						also process your practice data to generate recommendations and study plans.
					</li>
					<li>
						<strong>Super conversations:</strong> Super Coach and question-focused Super Tutor conversations,
						tool activity, and approved actions are stored for continuity and personalization. The standard
						free Tutor does not use this durable Super conversation system.
					</li>
					<li>
						<strong>Tutor memory:</strong> when you enable it and acknowledge its disclosure, the tutor
						may send recent tutor exchanges to Mem0 to extract limited learning preferences, study constraints,
						recurring misconceptions, and helpful explanation strategies. Memory is associated with a
						pseudonymous identifier and is not intended to store full transcripts.
					</li>
					<li>
						<strong>Bug reports and support requests:</strong> the title, description, reproduction steps,
						expected result, optional email address, severity, and technical question metadata you submit.
					</li>
					<li>
						<strong>Transactional requests:</strong> password reset, verification, and account deletion
						requests.
					</li>
					<li>
						<strong>Billing data:</strong> subscription and billing status, plan, billing period, and
						Stripe customer and subscription identifiers. Stripe handles payment-card details.
					</li>
					<li>
						<strong>Referral data:</strong> referral codes, attribution timestamps, and the account relationship
						needed to measure referrals.
					</li>
				</ul>
				<h3 class="mt-4 text-lg font-medium">2.2 Automatically Collected Data</h3>
				<ul class="list-disc space-y-1 pl-6">
					<li>
						Server and hosting logs such as IP address, request path, timestamps, and status codes
					</li>
					<li>
						Browser, device, approximate location, and network information sent through standard
						HTTP headers
					</li>
					<li>
						Usage information such as page visits, feature interactions, and authentication state
					</li>
					<li>
						Security, reliability, performance, and error information collected through Vercel,
						Sentry, and application logs
					</li>
					<li>
						<strong>When optional analytics are enabled:</strong> product analytics events, feature usage,
						a pseudonymous account identifier after sign-in, client-side errors, and masked session-replay
						data collected through PostHog
					</li>
				</ul>
				<h3 class="mt-4 text-lg font-medium">2.3 Information Stored Locally in Your Browser</h3>
				<ul class="list-disc space-y-1 pl-6">
					<li>Theme, layout, and settings preferences</li>
					<li>Analytics consent, an analytics journey key, and related opt-in measurement flags</li>
					<li>Onboarding, first-use hint, referral, timezone, and sidebar-state cookies</li>
					<li>
						Temporary conversation identifiers, Coach state, and written-response drafts in session
						storage
					</li>
				</ul>
			</section>

			<section>
				<h2 class="text-xl font-semibold">3. How We Use Your Information</h2>
				<ul class="list-disc space-y-1 pl-6">
					<li>
						To create and serve practice questions, written-response grades, explanations, and tutor
						responses
					</li>
					<li>To authenticate accounts, maintain sessions, and protect the Service</li>
					<li>To track progress, bookmarks, attempts, referrals, and saved preferences</li>
					<li>To personalize tutoring and build or update study plans</li>
					<li>To send transactional emails such as verification and password reset emails</li>
					<li>To process subscriptions, payments, taxes, cancellations, and account access</li>
					<li>To respond to bug reports, account requests, and support inquiries</li>
					<li>To prevent abuse, fraud, unauthorized access, and excessive automated use</li>
					<li>
						To analyze usage trends and improve reliability, quality, and performance when optional
						analytics are enabled
					</li>
				</ul>
			</section>

			<section>
				<h2 class="text-xl font-semibold">4. Data Storage and Security</h2>
				<p>
					We store account, practice, personalization, billing-mirror, and feature data in
					Neon-hosted PostgreSQL. Generated question content and related assets may also be stored
					in PostgreSQL. Passwords are stored as hashes, not plain text, and OAuth tokens are
					encrypted by the authentication system. Authentication uses secure HTTP-only session
					cookies. We use access controls, validation, rate limits, and monitoring appropriate to a
					personal project, but no method of transmission or storage is completely secure.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">5. Super AI and Tutor Memory</h2>
				<p>
					Super’s personalized tutor, Coach, and study plans use your selected AP classes, target
					dates, study availability, teaching-style preference, and scored practice patterns. We do
					not use these features to predict AP exam scores or make decisions about admission,
					employment, credit, insurance, or other high-impact opportunities.
				</p>
				<p class="mt-2">
					Tutor memory is optional and is limited to learning preferences, stable study constraints,
					and recurring course misconceptions. It is not a transcript store. We use a pseudonymous
					identifier rather than your account ID for this memory. You can pause memory reads and
					writes, inspect saved facts, delete individual facts, or delete all facts in Super setup.
					After Super access ends, tutor memory is retained for up to 90 days before scheduled
					deletion, unless you delete it sooner or delete your account.
				</p>
				<p class="mt-2">
					Super Coach and question Tutor use separate durable conversation threads, while sharing
					the student learning model and approved long-term memory. Question references and attempt
					identifiers are validated on the server; the browser does not provide canonical answers,
					grades, or hidden grading context as trusted input.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">6. Cookies and Local Storage</h2>
				<p>
					We use HTTP-only session cookies to keep you signed in, plus first-party cookies for
					onboarding, first-use hints, referral attribution, timezone, analytics consent, and
					sidebar state. Local storage stores theme and settings preferences and opt-in analytics
					controls. Session storage can hold temporary written-response drafts and Coach session
					state. Durable Super conversation messages remain server-side so a signed-in student can
					continue a Coach or question Tutor thread after reload.
				</p>
				<p class="mt-2">
					If you accept optional PostHog analytics, PostHog may set first-party cookies and use
					local storage to remember your device, session, and analytics preferences. Vercel
					Analytics and Speed Insights run in a cookieless mode for aggregate page views and
					performance signals. We do not use third-party advertising cookies. If you use a shared
					device, you should sign out when finished.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">7. Optional Analytics and Monitoring</h2>
				<p>
					PostHog product analytics are off by default. A consent banner asks before detailed
					PostHog tracking begins. We also use:
				</p>
				<ul class="mt-2 list-disc space-y-1 pl-6">
					<li>
						<strong>Vercel Analytics and Speed Insights:</strong> always-on, cookieless page views and
						performance-related signals
					</li>
					<li>
						<strong>PostHog (opt-in):</strong> product analytics, feature usage, masked session replay,
						client-side error tracking, and a pseudonymous account identifier after sign-in
					</li>
					<li>
						<strong>Sentry:</strong> production error and performance monitoring, which may receive error,
						request, browser, device, and diagnostic metadata
					</li>
				</ul>
				<p class="mt-2">
					Until you accept PostHog (or if you reject it), it may still load in a cookieless mode for
					limited anonymous page-view and page-leave measurement. It does not set PostHog cookies,
					store PostHog identifiers in your browser, or send detailed product events or account
					identification. Server-side
					operational metrics and security logs may still be collected. You can change this
					preference in Settings at any time.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">8. Third-Party Services and Sharing</h2>
				<ul class="list-disc space-y-1 pl-6">
					<li>
						<strong>OpenAI or an OpenAI-compatible provider:</strong> AI prompts, written responses, grading
						inputs, and generated outputs needed for AI operations
					</li>
					<li>
						<strong>Google:</strong> sign-in, Google One Tap, and identity information when configured
						and used
					</li>
					<li>
						<strong>Neon-hosted PostgreSQL:</strong> database storage for accounts, practice, feature
						data, and private bug reports
					</li>
					<li><strong>Resend:</strong> verification and password-reset email delivery</li>
					<li>
						<strong>PostHog:</strong> optional product analytics, error tracking, and session replay
					</li>
					<li>
						<strong>Vercel:</strong> hosting, deployment infrastructure, cookieless analytics, and related
						infrastructure
					</li>
					<li><strong>Sentry:</strong> production error and performance monitoring</li>
					<li>
						<strong>Stripe:</strong> payment processing, tax calculation, and subscription management
					</li>
					<li><strong>Mem0:</strong> optional pseudonymous tutor-memory storage</li>
					<li>
						<strong>Upstash:</strong> short-lived rate-limit, usage, approval, and request-control data
					</li>
				</ul>
				<p class="mt-2">
					Bug reports may include the optional email address and technical question metadata you
					provide. They are stored in our private application database for review and support. Do
					not submit sensitive information in a bug report; use support email for private requests.
					Each third party has its own terms and privacy practices. We do not sell your personal
					information or use it for cross-context behavioral advertising.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">9. Retention and Deletion</h2>
				<p>
					We retain information for as long as needed to provide the Service, maintain security,
					resolve disputes, comply with law, and support legitimate operational needs. Current
					product retention behavior includes:
				</p>
				<ul class="mt-2 list-disc space-y-1 pl-6">
					<li>Study-plan records expire after approximately 90 days.</li>
					<li>
						Durable Super conversation messages and Coach audit records are retained while needed
						for Super continuity and are removed with the account.
					</li>
					<li>
						Tutor memory is scheduled for deletion after up to 90 days when Super access ends.
					</li>
					<li>
						Rate limits, usage counters, locks, idempotency keys, and other Redis controls are
						short-lived and expire automatically.
					</li>
					<li>
						Server logs, monitoring records, emails, billing records, backups, and bug reports
						follow the retention practices of the relevant operator or provider; we do not currently
						publish one fixed period for all of them.
					</li>
				</ul>
				<p class="mt-2">
					You can clear practice data from Settings, which removes question history, mastery
					progress, bookmarks, and written-response submissions while keeping your account. You can
					request account deletion in Settings or by contacting us. Account deletion initiates
					removal of app-owned account, profile, practice, personalization, referral,
					billing-mirror, study-plan, feedback, and audit records; authentication records are
					handled by Better Auth, Stripe subscriptions are canceled, and Mem0 cleanup is queued and
					retried. Information held by third parties, backups, logs, or support records may persist
					under their own practices or legal obligations.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">10. Your Rights and Choices</h2>
				<p>
					Depending on your location, you may have rights to access, correct, delete, or receive a
					copy of personal information, and to object to or limit certain processing. You can change
					optional PostHog consent in Settings, disable tutor memory, delete memories, clear
					practice data, or request account deletion. Contact us to exercise a right or ask for
					help; we may need to verify the request and may retain information where law or security
					requires it.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">11. Children’s Privacy</h2>
				<p>
					The Service is intended for students aged 13 and older and is not directed to children
					under 13. Do not create an account or submit personal information if you are under 13. We
					do not knowingly collect personal information from children under 13. If we learn that we
					have done so, we will take reasonable steps to delete it. A parent or guardian who
					believes a child has used the Service should contact us promptly.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">12. International Transfers</h2>
				<p>
					Your information may be processed in the United States or other countries where we or our
					service providers operate. Where required, we take steps intended to protect the
					information in accordance with applicable law.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">13. Changes to This Privacy Policy</h2>
				<p>
					We may update this Privacy Policy from time to time. Changes will be posted on this page
					with a revised "Last Updated" date. Where required, we will provide additional notice.
					Continued use of the Service after changes take effect means you accept the updated
					policy.
				</p>
			</section>

			<section>
				<h2 class="text-xl font-semibold">14. Contact Us</h2>
				<p>
					For questions about this policy or to exercise your privacy rights, contact us at:<br />
					Operator: <strong>Ajay Saravanan</strong><br />
					Website: <strong>freeappractice.org</strong><br />
					Email:
					<a href="mailto:support@freeappractice.org" class="underline underline-offset-4"
						>support@freeappractice.org</a
					>
				</p>
				<p class="mt-4">
					See also our
					<a href={resolve('/terms')} class="underline underline-offset-4">Terms of Service</a>.
				</p>
			</section>
		</div>
	</div>
</main>
