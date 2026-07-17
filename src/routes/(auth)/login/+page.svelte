<script lang="ts">
	import LoginForm from '$lib/components/auth/login-form.svelte';
	import AuthSeoHead from '$lib/components/auth/auth-seo-head.svelte';
</script>

<AuthSeoHead
	title="Login – Free AP Practice"
	description="Sign in to your Free AP Practice account."
	path="/login"
/>

<LoginForm />
