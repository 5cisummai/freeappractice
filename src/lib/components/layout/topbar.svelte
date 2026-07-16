<script lang="ts">
	import MenuIcon from '@lucide/svelte/icons/menu';
	import XIcon from '@lucide/svelte/icons/x';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.png';
	import { Button } from '$lib/components/ui/button/index.js';
	import ThemeToggle from '$lib/components/layout/theme-toggle.svelte';
	import { topbarAuthItems, topbarNavItems } from '$lib/site-nav.js';

	let mobileOpen = $state(false);

	const toggleMobileMenu = () => {
		mobileOpen = !mobileOpen;
	};
</script>

<header class="topbar bg relative z-50 border-b border-border/70 backdrop-blur-sm">
	<div
		class="relative mx-auto flex h-18 w-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10"
	>
		<div class="topbar-logo">
			<a
				href={resolve('/')}
				class="logo-link flex items-center gap-0 text-base font-semibold tracking-tight lg:gap-3"
			>
				<img src={logo} alt="Free AP Practice logo" class="size-7 rounded-sm" />
				<span class="hidden lg:inline">Free AP Practice</span>
			</a>
		</div>

		<div class="flex items-center gap-3">
			<Button
				onclick={toggleMobileMenu}
				variant="ghost"
				size="icon"
				class="block sm:hidden"
				aria-label="Toggle navigation"
			>
				{#if mobileOpen}
					<XIcon class="h-5 w-5" />
				{:else}
					<MenuIcon class="h-5 w-5" />
				{/if}
			</Button>

			<nav class="hidden items-center gap-2 text-base sm:flex" aria-label="Main navigation">
				{#each topbarNavItems as item (item.href)}
					<Button href={resolve(item.href)} variant="ghost">{item.label}</Button>
				{/each}
				{#each topbarAuthItems as item, index (item.href)}
					<Button
						href={resolve(item.href)}
						variant={index === topbarAuthItems.length - 1 ? 'default' : 'ghost'}
						class={index === topbarAuthItems.length - 1 ? 'rounded-full px-4' : undefined}
					>
						{item.label}
					</Button>
				{/each}
				<ThemeToggle />
			</nav>
		</div>

		{#if mobileOpen}
			<nav
				class="absolute top-full right-0 left-0 z-50 rounded-b-xl border border-border/70 bg-background px-5 py-3 shadow-lg sm:hidden"
				aria-label="Mobile navigation"
			>
				{#each topbarNavItems as item (item.href)}
					<a
						href={resolve(item.href)}
						class="block py-2 text-muted-foreground transition-colors hover:text-foreground"
					>
						{item.label}
					</a>
				{/each}
				{#each topbarAuthItems as item (item.href)}
					<a
						href={resolve(item.href)}
						class="block py-2 font-medium text-foreground transition-colors hover:text-primary"
					>
						{item.label}
					</a>
				{/each}
				<div class="mt-2">
					<ThemeToggle variant="full" />
				</div>
			</nav>
		{/if}
	</div>
</header>
