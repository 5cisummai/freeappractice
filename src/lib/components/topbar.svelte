<script lang="ts">
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { toggleMode } from 'mode-watcher';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.png';
	import { Button } from '$lib/components/ui/button/index.js';
	import { auth } from '$lib/client/auth.svelte.js';
	import { onMount } from 'svelte';

	type TopbarProps = {
		showSignIn?: boolean;
	};

	let { showSignIn = true }: TopbarProps = $props();

	onMount(() => {
		auth.init();
	});

</script>

<header class="topbar bg border-b border-border/70 backdrop-blur-sm">
	<div
		class="mx-auto flex h-18 w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10"
	>
		<div class="topbar-logo">
			<a
				href={resolve('/')}
				class="logo-link flex items-center gap-3 text-base font-semibold tracking-tight"
			>
				<img src={logo} alt="Free AP Practice logo" class="size-7 rounded-sm" />
				<span>Free AP Practice</span>
			</a>
		</div>

		<nav class="topbar-nav flex items-center gap-5 text-base" aria-label="Main navigation">
			<a
				href={resolve('/blog')}
				class="nav-link text-muted-foreground transition-colors hover:text-foreground"
			>
				Blog
			</a>
			<a
				href={resolve('/about')}
				target="_blank"
				rel="noopener noreferrer"
				class="nav-link text-muted-foreground transition-colors hover:text-foreground"
			>
				About
			</a>

			<a
				href={resolve('/privacy')}
				target="_blank"
				rel="noopener noreferrer"
				class="nav-link text-muted-foreground transition-colors hover:text-foreground"
			>
				Privacy
			</a>
			<a
				href={resolve('/terms')}
				target="_blank"
				rel="noopener noreferrer"
				class="nav-link text-muted-foreground transition-colors hover:text-foreground"
			>
				Terms
			</a>
			{#if showSignIn}
				<a href={resolve('/login')} class="nav-link nav-signin font-medium text-foreground">
					Sign In
				</a>
			{/if}

			<Button onclick={toggleMode} variant="outline" size="icon" class="relative">
				<SunIcon
					class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all! dark:scale-0 dark:-rotate-90"
				/>
				<MoonIcon
					class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all! dark:scale-100 dark:rotate-0"
				/>
				<span class="sr-only">Toggle theme</span>
			</Button>
		</nav>
	</div>
</header>
