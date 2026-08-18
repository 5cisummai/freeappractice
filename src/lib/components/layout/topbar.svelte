<script lang="ts">
	import MenuIcon from '@lucide/svelte/icons/menu';
	import XIcon from '@lucide/svelte/icons/x';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.png';
	import { Button } from '$lib/components/ui/button/index.js';
	import ThemeToggle from '$lib/components/layout/theme-toggle.svelte';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu/index.js';
	import {
		topbarAuthItems,
		topbarNavItems,
		topbarPricingItem,
		topbarResourceItems
	} from '$lib/site-nav.js';

	let { showPricing = true }: { showPricing?: boolean } = $props();
	let mobileOpen = $state(false);
</script>

<header class="topbar relative z-50 border-b border-border/40 bg-transparent">
	<div class="relative mx-auto flex h-14 w-full max-w-7xl items-center px-5 sm:px-8 lg:px-10">
		<div class="topbar-logo flex min-w-0 flex-1 items-center">
			<a
				href={resolve('/')}
				class="logo-link flex items-center gap-3 text-base font-semibold tracking-tight"
			>
				<img src={logo} alt="Free AP Practice logo" class="size-7 rounded-sm" />
				<span>Free AP Practice</span>
			</a>
		</div>

		<nav
			class="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center text-base sm:flex"
			aria-label="Main navigation"
		>
			<NavigationMenu.Root class="relative z-50">
				<NavigationMenu.List class="gap-1">
					{#each topbarNavItems as item (item.href)}
						<NavigationMenu.Item>
							<NavigationMenu.Link
								href={resolve(item.href)}
								class="font-medium text-foreground hover:text-foreground"
							>
								{item.label}
							</NavigationMenu.Link>
						</NavigationMenu.Item>
					{/each}

					<NavigationMenu.Item value="resources">
						<NavigationMenu.Trigger>Resources</NavigationMenu.Trigger>
						<NavigationMenu.Content>
							<ul class="grid w-72 gap-1 p-1">
								{#each topbarResourceItems as item (item.href)}
									<li>
										<NavigationMenu.Link
											href={resolve(item.href)}
											class="flex-col items-start gap-1.5 p-3"
										>
											<span
												class={[
													'text-sm font-medium',
													item.href === '/super' ? 'super-text-gradient' : 'text-foreground'
												]}
											>
												{item.label}
											</span>
											<span class="text-xs leading-5 text-muted-foreground">
												{item.description}
											</span>
										</NavigationMenu.Link>
									</li>
								{/each}
							</ul>
						</NavigationMenu.Content>
					</NavigationMenu.Item>

					{#if showPricing}
						<NavigationMenu.Item>
							<NavigationMenu.Link
								href={resolve(topbarPricingItem.href)}
								class="font-medium text-foreground hover:text-foreground"
							>
								{topbarPricingItem.label}
							</NavigationMenu.Link>
						</NavigationMenu.Item>
					{/if}
				</NavigationMenu.List>
			</NavigationMenu.Root>
		</nav>

		<div class="flex flex-1 items-center justify-end gap-3">
			<Button
				onclick={() => (mobileOpen = !mobileOpen)}
				variant="ghost"
				size="icon"
				class="block sm:hidden"
				aria-label="Toggle navigation"
				aria-expanded={mobileOpen}
				aria-controls="mobile-navigation"
			>
				{#if mobileOpen}
					<XIcon class="h-5 w-5" />
				{:else}
					<MenuIcon class="h-5 w-5" />
				{/if}
			</Button>

			<div class="hidden items-center gap-3 sm:flex">
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
			</div>
		</div>

		{#if mobileOpen}
			<nav
				id="mobile-navigation"
				class="absolute top-full right-0 left-0 z-50 rounded-b-xl border border-border/70 bg-background px-5 py-4 shadow-lg sm:hidden"
				aria-label="Mobile navigation"
			>
				<div class="grid gap-1">
					{#each topbarNavItems as item (item.href)}
						<a
							href={resolve(item.href)}
							class="rounded-md px-2 py-2.5 font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
						>
							{item.label}
						</a>
					{/each}
					{#each topbarResourceItems.filter((item) => item.href !== '/super') as item (item.href)}
						<a
							href={resolve(item.href)}
							class="rounded-md px-2 py-2.5 font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
						>
							{item.label}
						</a>
					{/each}
					{#if showPricing}
						<a
							href={resolve(topbarPricingItem.href)}
							class="rounded-md px-2 py-2.5 font-medium text-foreground transition-colors hover:bg-muted hover:text-primary"
						>
							{topbarPricingItem.label}
						</a>
					{/if}
				</div>

				<div class="mt-3 grid grid-cols-2 gap-2 pt-3">
					{#each topbarAuthItems as item, index (item.href)}
						<Button
							href={resolve(item.href)}
							variant={index === topbarAuthItems.length - 1 ? 'default' : 'outline'}
							class="w-full rounded-full"
						>
							{item.label}
						</Button>
					{/each}
				</div>
				<div class="mt-3 pt-3">
					<ThemeToggle variant="full" />
				</div>
			</nav>
		{/if}
	</div>
</header>
