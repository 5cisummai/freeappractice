<script lang="ts">
	import LoginForm from '$lib/components/login-form.svelte';
	import logo from '$lib/assets/logo.png';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Login – Free AP Practice</title>
	<meta name="description" content="Sign in to your Free AP Practice account." />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="https://freeappractice.org/login" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/login" />
	<meta property="og:title" content="Login – Free AP Practice" />
	<meta property="og:description" content="Sign in to your Free AP Practice account." />
	<meta property="og:image" content="https://freeappractice.org/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/login" />
	<meta name="twitter:title" content="Login – Free AP Practice" />
	<meta name="twitter:description" content="Sign in to your Free AP Practice account." />
	<meta name="twitter:image" content="https://freeappractice.org/icon.png" />
</svelte:head>

<div class="bg flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href={resolve('/')} class="flex items-center gap-2 self-center font-medium">
			<img src={logo} alt="Free AP Practice" class="size-6 rounded-sm" />
			Free AP Practice
		</a>
		<LoginForm />
	</div>
</div>
