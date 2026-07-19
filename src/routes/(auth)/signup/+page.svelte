<script lang="ts">
	import { onMount } from 'svelte';
	import SignupForm from '$lib/components/auth/signup-form.svelte';
	import AuthSeoHead from '$lib/components/auth/auth-seo-head.svelte';
	import { captureSignupStarted } from '$lib/client/activation-analytics';

	onMount(() => {
		captureSignupStarted('page');
	});
</script>

<AuthSeoHead
	title="Sign Up – Free AP Practice"
	description="Create your Free AP Practice account."
	path="/signup"
/>

<SignupForm />
