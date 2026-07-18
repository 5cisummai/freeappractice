<script lang="ts">
	import logo from '$lib/assets/logo.png';
	import { resolve } from '$app/paths';

	let { children } = $props();
</script>

<main
	id="main-content"
	class="bg flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10"
>
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href={resolve('/')} class="flex items-center gap-2 self-center font-medium">
			<img src={logo} alt="Free AP Practice" class="size-6 rounded-sm" />
			Free AP Practice
		</a>
		{@render children()}
	</div>
</main>
