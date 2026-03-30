<script lang="ts">
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
	<meta property="og:image" content="https://freeappractice.org/assets/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/privacy" />
	<meta name="twitter:title" content="Privacy Policy – Free AP Practice" />
	<meta name="twitter:description" content="Privacy Policy for Free AP Practice" />
	<meta name="twitter:image" content="https://freeappractice.org/assets/icon.png" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main class="flex-1 py-12">
		<div class="mx-auto w-full max-w-3xl space-y-8 px-5 sm:px-8">
			<a href="/" class="text-sm text-muted-foreground hover:text-foreground">← Back to Home</a>

			<div class="space-y-2">
				<h1 class="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
				<p class="text-sm text-muted-foreground">Last Updated: January 22, 2026</p>
			</div>

			<div class="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-base leading-7">
				<section>
					<h2 class="text-xl font-semibold">1. Introduction</h2>
					<p>
						Welcome to Free AP Practice ("Service", "we", "us", or "our"). This Privacy Policy
						explains how we collect, use, disclose, and safeguard information when you use our
						website and services, including account-based features introduced in recent updates.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">2. Information We Collect</h2>
					<h3 class="text-lg font-medium">2.1 Information You Provide Directly</h3>
					<ul class="list-disc space-y-1 pl-6">
						<li><strong>Account data:</strong> name, email address, and password (hashed)</li>
						<li>
							<strong>Practice data:</strong> answers submitted, question attempts, and bookmarks
						</li>
						<li><strong>Bug reports:</strong> text descriptions and related metadata you submit</li>
					</ul>
					<h3 class="mt-4 text-lg font-medium">2.2 Automatically Collected Data</h3>
					<ul class="list-disc space-y-1 pl-6">
						<li>Basic server logs (IP address, request timestamps, HTTP status codes)</li>
						<li>Browser type and device information via standard HTTP headers</li>
					</ul>
				</section>

				<section>
					<h2 class="text-xl font-semibold">3. How We Use Your Information</h2>
					<ul class="list-disc space-y-1 pl-6">
						<li>To provide and improve the Service (question generation, progress tracking)</li>
						<li>To authenticate your account and maintain session security</li>
						<li>To send transactional emails (email verification, password reset)</li>
						<li>To respond to bug reports and support requests</li>
						<li>To analyze usage patterns and improve question quality</li>
					</ul>
				</section>

				<section>
					<h2 class="text-xl font-semibold">4. Data Storage and Security</h2>
					<p>
						Your data is stored in MongoDB Atlas and files may be stored in AWS S3. Data at rest is
						encrypted. Passwords are hashed with bcrypt and never stored in plain text. JWT tokens
						are used for session authentication and expire after 14 days.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">5. Cookies and Local Storage</h2>
					<p>
						We use <code>localStorage</code> to persist your authentication token on your device. We do
						not use third-party tracking cookies. Theme preference is stored locally in your browser.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">6. Third-Party Services</h2>
					<ul class="list-disc space-y-1 pl-6">
						<li>
							<strong>OpenAI:</strong> Question generation — prompts and responses are processed by OpenAI's
							API
						</li>
						<li><strong>AWS S3:</strong> File storage for generated question content</li>
						<li><strong>Resend:</strong> Transactional email delivery</li>
					</ul>
					<p class="mt-2">
						Each third party has its own privacy policy. We do not sell your personal data to third
						parties.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">7. Your Rights</h2>
					<p>
						You may request to access, correct, or delete your personal data at any time. To delete
						your account, use the account settings page or contact us directly. We will remove your
						data from primary systems within a reasonable timeframe.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">8. Children's Privacy</h2>
					<p>
						The Service is intended for students of all ages. We do not knowingly collect personal
						information from children under 13 without parental consent as required by applicable
						law.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">9. International Transfers</h2>
					<p>
						Data stored on our servers and in S3 may be processed in the United States or other
						jurisdictions. When transferring data internationally we take steps to protect it in
						accordance with applicable law.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">10. Changes to This Privacy Policy</h2>
					<p>
						We may update this Privacy Policy periodically. Material changes will be reflected in
						the "Last Updated" date and, where feasible, communicated to registered users. Continued
						use after changes constitutes acceptance of the updated policy.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">11. Contact Us</h2>
					<p>
						For questions about this policy or to exercise data rights, contact us at:<br />
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
