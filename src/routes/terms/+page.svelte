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
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/terms" />
	<meta name="twitter:title" content="Terms of Service – Free AP Practice" />
	<meta name="twitter:description" content="Terms of Service for Free AP Practice" />
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<Topbar />

	<main class="flex-1 py-12">
		<div class="mx-auto w-full max-w-3xl space-y-8 px-5 sm:px-8">
			<a href="{resolve('/')}" class="text-sm text-muted-foreground hover:text-foreground">← Back to Home</a>

			<div class="space-y-2">
				<h1 class="text-4xl font-semibold tracking-tight">Terms of Service</h1>
				<p class="text-sm text-muted-foreground">Last Updated: March 29, 2026</p>
			</div>

			<div class="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-base leading-7">
				<section>
					<h2 class="text-xl font-semibold">1. Agreement to Terms</h2>
					<p>
						By accessing or using Free AP Practice (the "Service", "we", "us", or "our"), you
						agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use
						the Service.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">2. Accounts and Eligibility</h2>
					<p>
						Some features require an account, including progress syncing, bookmarks, saved settings,
						and history across devices. You must provide accurate information, keep your login
						credentials secure, and notify us if you believe your account has been compromised. You
						are responsible for activity that occurs under your account.
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
					<h2 class="text-xl font-semibold">4. User Content and Rights</h2>
					<p>
						Content you submit, including profile information, answers, bookmarks, feedback, bug
						reports, and support requests, remains yours. By submitting content, you grant us a
						non-exclusive license to host, process, store, display, and analyze that content as
						reasonably necessary to operate, maintain, and improve the Service, subject to our
						<a href="{resolve('/privacy')}" class="underline underline-offset-4">Privacy Policy</a>.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">5. AI-Generated Content</h2>
					<p>
						The Service uses OpenAI to generate practice questions, explanations, and tutoring
						content. AI-generated content can be incomplete, incorrect, or misleading. You should
						use your own judgment and, when appropriate, verify answers against trusted sources. The
						Service is provided for study support only and does not guarantee exam results or
						academic outcomes.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">6. Acceptable Use</h2>
					<p>
						You agree not to misuse the Service. Prohibited activities include harassment, illegal
						activity, distributing malware, attempting unauthorized access, scraping data at scale,
						circumventing security controls, reverse engineering protected parts of the Service,
						or using the Service to generate harmful, abusive, or disallowed content.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">7. Third-Party Services</h2>
					<p>
						The Service depends on third-party providers, including OpenAI for question generation,
						MongoDB Atlas for database storage, AWS S3 for file storage, Resend for transactional
						emails, and Vercel for hosting and deployment. Those providers may process data according
						to their own terms and privacy policies.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">8. Disclaimers and Limitations</h2>
					<p>
						The Service and all content are provided "as is" and "as available" without warranties of
						any kind, express or implied. To the maximum extent permitted by law, we disclaim
						liability for indirect, incidental, special, consequential, or punitive damages arising
						from your use of the Service.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">9. Termination</h2>
					<p>
						We may suspend or terminate access to the Service at any time for violations of these
						Terms, security concerns, or operational reasons. You may delete your account through the
						Service or by contacting us. Deletion removes data from primary systems within a
						reasonable period, although some information may remain in backups for a limited time.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">10. Governing Law and Disputes</h2>
					<p>
						These Terms are governed by the laws applicable in the United States, without regard to
						conflict-of-law principles. Any dispute will be handled in a lawful forum with competent
						jurisdiction unless the parties agree otherwise in writing.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">11. Changes to Terms</h2>
					<p>
						We may update these Terms from time to time. The updated version will be posted on this
						page with a revised "Last Updated" date. Continued use of the Service after changes take
						effect means you accept the revised Terms.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold">12. Contact Information</h2>
					<p>
						If you have questions about these Terms, contact us at:<br />
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
