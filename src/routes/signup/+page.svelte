<script>
	import logo from '$lib/assets/logo.png';
	import SignupForm from '$lib/components/signup-form.svelte';
</script>

<svelte:head>
	<title>Sign Up – Free AP Practice</title>
	<meta name="description" content="Create your Free AP Practice account." />
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href="https://freeappractice.org/signup" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://freeappractice.org/signup" />
	<meta property="og:title" content="Sign Up – Free AP Practice" />
	<meta property="og:description" content="Create your Free AP Practice account." />
	<meta property="og:image" content="https://freeappractice.org/assets/icon.png" />
	<meta property="og:site_name" content="FreeAPPractice.org" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:url" content="https://freeappractice.org/signup" />
	<meta name="twitter:title" content="Sign Up – Free AP Practice" />
	<meta name="twitter:description" content="Create your Free AP Practice account." />
	<meta name="twitter:image" content="https://freeappractice.org/assets/icon.png" />
</svelte:head>

<div class="bg flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href="/" class="flex items-center gap-2 self-center font-medium">
			<img src={logo} alt="Free AP Practice" class="size-6 rounded-sm" />
			Free AP Practice
		</a>
		<SignupForm />
	</div>
</div>
