<script lang="ts">
	import { resolve } from '$app/paths';
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Topbar from '$lib/components/topbar.svelte';
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

	<main class="flex-1 py-12">
		<div class="mx-auto w-full max-w-3xl space-y-8 px-5 sm:px-8">
			<a href="{resolve('/')}" class="text-sm text-muted-foreground hover:text-foreground"
				>← Back to Home</a
			>

			<div class="space-y-2">
				<h1 class="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
				<p class="text-sm text-muted-foreground">Last Updated: March 29, 2026</p>
			</div>

			<div class="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-base leading-7">
				<section>
					<h2 class="text-xl font-semibold">1. Introduction</h2>
					<p>
						This Privacy Policy explains how Free AP Practice ("Service", "we", "us", or "our")
						collects, uses, stores, and shares information when you use the website and related
						features.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">2. Information We Collect</h2>
					<h3 class="text-lg font-medium">2.1 Information You Provide Directly</h3>
					<ul class="list-disc space-y-1 pl-6">
						<li><strong>Account data:</strong> name, email address, and password hash</li>
						<li>
							<strong>Practice data:</strong> answers submitted, question attempts, FRQ responses,
							progress, and bookmarks
						</li>
						<li><strong>Bug reports and support requests:</strong> text and metadata you submit</li>
						<li><strong>Transactional requests:</strong> password reset, verification, and account deletion requests</li>
					</ul>
					<h3 class="mt-4 text-lg font-medium">2.2 Automatically Collected Data</h3>
					<ul class="list-disc space-y-1 pl-6">
						<li>Server logs such as IP address, request path, timestamps, and status codes</li>
						<li>Browser and device information sent through standard HTTP headers</li>
						<li>Usage information such as page visits, feature interactions, and authentication state</li>
					</ul>
					<h3 class="mt-4 text-lg font-medium">2.3 Information Stored Locally in Your Browser</h3>
					<ul class="list-disc space-y-1 pl-6">
						<li>Authentication token and basic user profile data</li>
						<li>Theme and accessibility preferences</li>
						<li>Draft or in-progress state needed to keep the app responsive between refreshes</li>
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
						<li>To analyze usage trends and improve reliability, quality, and performance</li>
					</ul>
				</section>

				<section>
					<h2 class="text-xl font-semibold">4. Data Storage and Security</h2>
					<p>
						We store account and progress data in MongoDB Atlas and may store generated question
						content and related files in AWS S3. Passwords are stored as hashes, not plain text. We
						use bearer tokens for authentication, and those tokens expire after a limited period.
						No method of transmission or storage is completely secure, so we cannot guarantee absolute
						security.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">5. Cookies and Local Storage</h2>
					<p>
						We use local browser storage to keep you signed in and to save theme and accessibility
						preferences. We do not use third-party advertising cookies. If you use a shared device,
						you should sign out when finished.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">6. Third-Party Services</h2>
					<ul class="list-disc space-y-1 pl-6">
						<li>
							<strong>OpenAI:</strong> prompts and generated question content are processed by OpenAI's API
						</li>
						<li><strong>MongoDB Atlas:</strong> database hosting for user accounts and progress data</li>
						<li><strong>AWS S3:</strong> file storage for generated question content and related assets</li>
						<li><strong>Resend:</strong> delivery of verification and reset emails</li>
						<li><strong>Vercel:</strong> website hosting and deployment infrastructure</li>
					</ul>
					<p class="mt-2">
						Each third party has its own terms and privacy practices. We do not sell your personal
						information.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">7. Your Rights</h2>
					<p>
						Depending on your location, you may have rights to access, correct, export, or delete your
						personal data. You can delete your account through the Service or contact us for help. We
						will remove data from primary systems within a reasonable period, subject to legal or
						operational retention requirements.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">8. Children's Privacy</h2>
					<p>
						The Service is intended for students, but it is not directed to children under 13. We do
						not knowingly collect personal information from children under 13 without verifiable
						parental consent where required by law.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">9. International Transfers</h2>
					<p>
						Your information may be processed in the United States or other countries where we or our
						service providers operate. Where required, we take steps intended to protect the
						information in accordance with applicable law.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">10. Changes to This Privacy Policy</h2>
					<p>
						We may update this Privacy Policy from time to time. Changes will be posted on this page
						with a revised "Last Updated" date. Continued use of the Service after changes take effect
						means you accept the updated policy.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">11. Contact Us</h2>
					<p>
						For questions about this policy or to exercise your privacy rights, contact us at:<br />
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

	<SiteFooter />
</div>
