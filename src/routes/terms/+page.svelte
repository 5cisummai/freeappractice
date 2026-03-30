<script lang="ts">
	import SiteFooter from '$lib/components/site-footer.svelte';
	import Topbar from '$lib/components/topbar.svelte';
	import { resolve } from '$app/paths';
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
	<meta property="og:image" content="https://freeappractice.org/assets/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/terms" />
	<meta name="twitter:title" content="Terms of Service – Free AP Practice" />
	<meta name="twitter:description" content="Terms of Service for Free AP Practice" />
	<meta name="twitter:image" content="https://freeappractice.org/assets/icon.png" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main class="flex-1 py-12">
		<div class="mx-auto w-full max-w-3xl space-y-8 px-5 sm:px-8">
			<a href="{resolve('/')}" class="text-sm text-muted-foreground hover:text-foreground">← Back to Home</a>

			<div class="space-y-2">
				<h1 class="text-4xl font-semibold tracking-tight">Terms of Service</h1>
				<p class="text-sm text-muted-foreground">Last Updated: January 22, 2026</p>
			</div>

			<div class="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-base leading-7">
				<section>
					<h2 class="text-xl font-semibold">1. Agreement to Terms</h2>
					<p>
						By accessing and using Free AP Practice (the "Service", "we", "us", or "our"), you
						accept and agree to be bound by and comply with these Terms of Service. If you do not
						agree to these terms, please do not use the Service.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">2. Accounts and Eligibility</h2>
					<p>
						Certain features (such as cross-device progress syncing and saved preferences) require
						creating an account. You must provide accurate information and keep your account
						credentials secure. You are responsible for all activity under your account. We may
						refuse service or terminate accounts for violations of these Terms.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">3. Use License</h2>
					<p>
						Permission is granted to temporarily use the Service for personal, non-commercial study
						purposes only. This is a license, not a transfer of title. You may not use the Service
						for commercial redistribution or reverse engineering of protected components.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">4. User Content and Rights</h2>
					<p>
						Content you submit (profile data, preferences, feedback) remains your property. By
						submitting content, you grant us a non-exclusive license to use that content to provide
						and improve the Service, subject to our
						<a href="{resolve('/privacy')}" class="underline underline-offset-4">Privacy Policy</a>.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">5. Data Storage and AWS S3</h2>
					<p>
						We store user data and generated question content on our servers. Generated questions
						and related metadata may be stored in AWS S3 for durability, analysis, and debugging.
						Access to S3 is restricted; data is encrypted at rest. See our
						<a href="{resolve('/privacy')}" class="underline underline-offset-4">Privacy Policy</a> for details on
						retention and deletion.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">6. Acceptable Use</h2>
					<p>
						You agree not to misuse the Service. Prohibited activities include harassment, illegal
						activity, distributing malware, unauthorized access attempts, scraping data at scale,
						and abusing the AI generation functionality for disallowed content. We reserve the right
						to suspend accounts that violate these rules.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">7. Payment and Commercial Use</h2>
					<p>
						Currently the Service is free. If we introduce paid features in the future, additional
						terms will apply and will be communicated prior to billing.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">8. Disclaimers and Limitations</h2>
					<p>
						The Service and all materials are provided "as is" without warranties. We are not
						responsible for AI-generated inaccuracies. To the maximum extent permitted by law, we
						disclaim liability for indirect, incidental, or consequential damages.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">9. Termination</h2>
					<p>
						We may terminate or suspend accounts for violations of these Terms or for operational
						reasons. You may request account deletion; deletion requests will remove personal data
						from primary systems within a reasonable timeframe but may not remove data from backups
						immediately.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">10. Governing Law and Disputes</h2>
					<p>
						These Terms are governed by the laws of the United States. Disputes shall be resolved
						via arbitration or other lawful means as described in our legal policy.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">11. Changes to Terms</h2>
					<p>
						We may modify these Terms. Material changes will be communicated to registered users
						when feasible. Continued use after modifications constitutes acceptance of the updated
						terms.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">12. Contact Information</h2>
					<p>
						If you have questions about these Terms, contact us:<br />
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
