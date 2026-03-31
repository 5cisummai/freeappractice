<script lang="ts">
	import { auth } from '$lib/client/auth.svelte.js';
	import logo from '$lib/assets/logo.png';
</script>

<svelte:head>
	<title>Email Sent – Free AP Practice</title>
	<meta name="description" content="Check your inbox for the next step in Free AP Practice account setup." />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="https://freeappractice.org/email-sent" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/email-sent" />
	<meta property="og:title" content="Email Sent – Free AP Practice" />
	<meta
		property="og:description"
		content="Check your inbox for the next step in Free AP Practice account setup."
	/>
	<meta property="og:image" content="https://freeappractice.org/assets/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/email-sent" />
	<meta name="twitter:title" content="Email Sent – Free AP Practice" />
	<meta
		name="twitter:description"
		content="Check your inbox for the next step in Free AP Practice account setup."
	/>
	<meta name="twitter:image" content="https://freeappractice.org/assets/icon.png" />
</svelte:head>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6 text-center">
		<a href="/" class="flex items-center gap-2 self-center font-medium">
			<img src={logo} alt="Free AP Practice" class="size-6 rounded-sm" />
			Free AP Practice
		</a>

		<div class="space-y-4">
			<div
				class="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-100 text-2xl text-blue-600"
			>
				✉
			</div>
			<h1 class="text-xl font-semibold">Check your email</h1>
			<p class="text-sm text-muted-foreground">
				We sent a verification link to
				{#if auth.user?.email}
					<strong>{auth.user.email}</strong>.
				{:else}
					your email address.
				{/if}
				Click the link to activate your account.
			</p>
			<p class="text-xs text-muted-foreground">
				The link expires in 24 hours. Check your spam folder if you don't see it.
			</p>
		</div>

		<div class="flex flex-col gap-2 text-sm">
			<a href="/login" class="underline underline-offset-4">Back to sign in</a>
		</div>
	</div>
</div>
