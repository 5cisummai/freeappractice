<script lang="ts">
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Topbar from '$lib/components/topbar.svelte';
	import PublicPageHero from '$lib/components/public-page-hero.svelte';
	import BackToHome from '$lib/components/back-to-home.svelte';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Privacy Policy – Free AP Practice</title>
	<meta name="description" content="Privacy Policy for Free AP Practice" />
	<meta name="author" content="FreeAPPractice.org" />
	<meta name="robots" content="index, follow" />
	<link rel="canonical" href="https://freeappractice.org/privacy" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/privacy" />
	<meta property="og:title" content="Privacy Policy – Free AP Practice" />
	<meta property="og:description" content="Privacy Policy for Free AP Practice" />
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/privacy" />
	<meta name="twitter:title" content="Privacy Policy – Free AP Practice" />
	<meta name="twitter:description" content="Privacy Policy for Free AP Practice" />
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main id="main-content" class="flex-1 py-12">
		<div class="mx-auto w-full max-w-3xl space-y-8 px-5 sm:px-8">
			<BackToHome />

			<PublicPageHero
				title="Privacy Policy"
				description="How we collect, use, and protect your information when you use Free AP Practice."
				meta="Last Updated: June 25, 2026"
			/>

			<div class="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-base leading-7">
				<section>
					<h2 class="text-xl font-semibold">1. Introduction</h2>
					<p>
						This Privacy Policy explains how Free AP Practice ("Service", "we", "us", or "our")
						collects, uses, stores, and shares information when you use the website and related
						features. Free AP Practice is a personal project maintained by Ajay Saravanan.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">2. Information We Collect</h2>
					<h3 class="text-lg font-medium">2.1 Information You Provide Directly</h3>
					<ul class="list-disc space-y-1 pl-6">
						<li><strong>Account data:</strong> name, email address, and password hash</li>
						<li>
							<strong>Practice data:</strong> answers submitted, question attempts, progress, and bookmarks
						</li>
						<li><strong>Bug reports and account requests:</strong> text and metadata you submit</li>
						<li>
							<strong>Transactional requests:</strong> password reset, verification, and account deletion
							requests
						</li>
						<li>
							<strong>User-provided responses:</strong> AI tutor prompts may be sent to OpenAI for processing
							so the Service can generate responses. Please do not submit sensitive personal information.
						</li>
					</ul>
					<h3 class="mt-4 text-lg font-medium">2.2 Automatically Collected Data</h3>
					<ul class="list-disc space-y-1 pl-6">
						<li>Server logs such as IP address, request path, timestamps, and status codes</li>
						<li>Browser and device information sent through standard HTTP headers</li>
						<li>
							Usage information such as page visits, feature interactions, and authentication state
						</li>
						<li>
							<strong>When optional analytics are enabled:</strong> product analytics events, performance
							signals, client-side error reports, and session replay data collected through PostHog and
							Vercel Analytics
						</li>
					</ul>
					<h3 class="mt-4 text-lg font-medium">2.3 Information Stored Locally in Your Browser</h3>
					<ul class="list-disc space-y-1 pl-6">
						<li>Theme preferences and optional analytics choice</li>
						<li>
							Draft or in-progress practice state needed to keep the app responsive between
							refreshes
						</li>
					</ul>
				</section>

				<section>
					<h2 class="text-xl font-semibold">3. How We Use Your Information</h2>
					<ul class="list-disc space-y-1 pl-6">
						<li>To create and serve practice questions, explanations, and tutor responses</li>
						<li>To authenticate accounts, maintain sessions, and protect the Service</li>
						<li>To track progress, bookmarks, attempts, and saved preferences</li>
						<li>To send transactional emails such as verification and password reset emails</li>
						<li>To respond to bug reports, account requests, and support inquiries</li>
						<li>
							To analyze usage trends and improve reliability, quality, and performance when
							optional analytics are enabled
						</li>
					</ul>
				</section>

				<section>
					<h2 class="text-xl font-semibold">4. Data Storage and Security</h2>
					<p>
						We store account and progress data in MongoDB, and generated question content may also
						be stored in MongoDB and AWS S3 depending on the feature being used. Passwords are
						stored as hashes, not plain text. We use secure HTTP-only session cookies for
						authentication through Better Auth. No method of transmission or storage is completely
						secure, so we cannot guarantee absolute security.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">5. Cookies and Local Storage</h2>
					<p>
						We use HTTP-only session cookies to keep you signed in, along with local browser storage
						for theme preferences, optional analytics choice, and in-progress practice state. We
						also use a first-party cookie to remember sidebar state.
					</p>
					<p class="mt-2">
						If you accept optional analytics, PostHog may set first-party cookies and use local
						storage to remember your device, session, and analytics preferences. Vercel Analytics and
						Speed Insights may also load only after you opt in. We do not use third-party
						advertising cookies. If you use a shared device, you should sign out when finished.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">6. Optional Analytics</h2>
					<p>
						Optional analytics are off by default. A consent banner asks before any analytics tools
						load. If you choose to enable them, we may use:
					</p>
					<ul class="mt-2 list-disc space-y-1 pl-6">
						<li>
							<strong>PostHog:</strong> product analytics, feature usage events, client-side error
							tracking, and session replay to understand how the Service is used and to improve
							reliability
						</li>
						<li>
							<strong>Vercel Analytics and Speed Insights:</strong> page views and performance-related
							signals
						</li>
					</ul>
					<p class="mt-2">
						When analytics are disabled, PostHog and Vercel analytics scripts do not load and we do
						not send optional analytics events from your browser. Some server-side API activity is
						still logged for security and operations, but optional product-analytics events tied to
						your account are not sent unless you have opted in. You can change this preference in
						Settings at any time.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">7. Third-Party Services</h2>
					<ul class="list-disc space-y-1 pl-6">
						<li>
							<strong>OpenAI:</strong> prompts and generated question content are processed by OpenAI's
							API
						</li>
						<li>
							<strong>Google:</strong> sign-in flows may use Google Identity Services and Google ID tokens
						</li>
						<li>
							<strong>MongoDB:</strong> database storage for user accounts, progress data, and cached
							questions
						</li>
						<li>
							<strong>AWS S3:</strong> file storage for generated question content and related assets
						</li>
						<li>
							<strong>GitHub:</strong> bug reports are submitted as GitHub Issues when you use the in-app
							bug report form
						</li>
						<li><strong>Resend:</strong> delivery of verification and reset emails</li>
						<li>
							<strong>PostHog:</strong> optional product analytics, error tracking, and session replay
							when you opt in
						</li>
						<li>
							<strong>Vercel:</strong> website hosting, deployment infrastructure, and optional
							analytics when you opt in
						</li>
					</ul>
					<p class="mt-2">
						Each third party has its own terms and privacy practices. We do not sell your personal
						information.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">8. Your Rights</h2>
					<p>
						Depending on your location, you may have rights to access, correct, export, or delete
						your personal data. You can delete your account through the Service or contact us for
						help. We will delete your account record from our primary database, and some information
						may remain in backups, logs, or third-party systems for a limited period, subject to
						legal or operational retention requirements.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">9. Children's Privacy</h2>
					<p>
						The Service is intended for students, but it is not directed to children under 13. We do
						not knowingly collect personal information from children under 13. If you believe a
						child has provided us personal information, contact us and we will address the request
						appropriately.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">10. International Transfers</h2>
					<p>
						Your information may be processed in the United States or other countries where we or
						our service providers operate. Where required, we take steps intended to protect the
						information in accordance with applicable law.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">11. Changes to This Privacy Policy</h2>
					<p>
						We may update this Privacy Policy from time to time. Changes will be posted on this page
						with a revised "Last Updated" date. Continued use of the Service after changes take
						effect means you accept the updated policy.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">12. Contact Us</h2>
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

	<SiteFooter />
</div>
