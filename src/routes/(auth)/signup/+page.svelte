<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import SignupForm from '$lib/components/auth/signup-form.svelte';
	import AuthSeoHead from '$lib/components/auth/auth-seo-head.svelte';
	import { captureSignupStarted } from '$lib/client/activation-analytics';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import UsersRoundIcon from '@lucide/svelte/icons/users-round';

	const superSignup = $derived(page.url.searchParams.get('super') === '1');
	const groupSignup = $derived(page.url.searchParams.get('group') === '1');

	onMount(() => {
		captureSignupStarted('page');
	});
</script>

<AuthSeoHead
	title="Sign Up | Free AP Practice"
	description="Create your Free AP Practice account."
	path="/signup"
/>

{#if superSignup}
	<div class="flex justify-center">
		<span
			class="inline-flex items-center gap-1.5 rounded-full border border-violet-300/50 super-tier-gradient px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm shadow-violet-500/10 dark:text-violet-300"
		>
			<SparklesIcon class="size-3.5 text-violet-500" aria-hidden="true" />
			Sign up to access Super
		</span>
	</div>
{:else if groupSignup}
	<div class="flex justify-center">
		<span
			class="inline-flex items-center gap-1.5 rounded-full border border-sky-300/50 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm shadow-sky-500/10 dark:border-sky-400/30 dark:text-sky-300"
		>
			<UsersRoundIcon class="size-3.5 text-sky-500" aria-hidden="true" />
			Sign up to create a study group
		</span>
	</div>
{/if}

<SignupForm {superSignup} />
