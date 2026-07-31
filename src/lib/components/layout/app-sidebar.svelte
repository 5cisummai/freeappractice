<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.png';
	import NavUser from '$lib/components/layout/nav-user.svelte';
	import ThemeToggle from '$lib/components/layout/theme-toggle.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	import HouseIcon from '@lucide/svelte/icons/house';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CompassIcon from '@lucide/svelte/icons/compass';
	import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import FlameIcon from '@lucide/svelte/icons/flame';

	let {
		isAdmin,
		user,
		currentStreak = 0
	}: {
		isAdmin: boolean;
		user: { name: string; email: string; image?: string | null };
		currentStreak?: number;
	} = $props();

	const baseNavItems = [
		{ href: '/app', label: 'Home', icon: HouseIcon },
		{ href: '/app/practice', label: 'Practice', icon: BookOpenIcon },
		{ href: '/app/progress', label: 'Progress', icon: BarChart3Icon },
		{ href: '/app/resources', label: 'Resources', icon: CompassIcon },
		{ href: '/app/settings', label: 'Settings', icon: SettingsIcon }
	] as const;

	const adminNavItem = { href: '/app/admin', label: 'Admin', icon: ShieldIcon } as const;
	const navItems = $derived(isAdmin ? [...baseNavItems, adminNavItem] : baseNavItems);

	function isActive(href: (typeof navItems)[number]['href']): boolean {
		if (href === '/app') return page.url.pathname === resolve('/app');
		return page.url.pathname === resolve(href) || page.url.pathname.startsWith(resolve(href) + '/');
	}
</script>

<Sidebar.Root collapsible="offcanvas" variant="inset">
	<Sidebar.Header class="h-14 justify-center">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg" tooltipContent="Free AP Practice">
					{#snippet child({ props })}
						<a href={resolve('/app')} {...props}>
							<img src={logo} alt="Logo" class="size-7 rounded-sm" />
							<span class="font-semibold tracking-tight">Free AP Practice</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each navItems as item (item.href)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={isActive(item.href)}
								tooltipContent={item.label}
								class="data-active:bg-primary/10 data-active:font-medium data-active:text-primary"
							>
								{#snippet child({ props })}
									<a
										href={resolve(item.href)}
										aria-current={isActive(item.href) ? 'page' : undefined}
										{...props}
									>
										<item.icon />
										<span>{item.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="gap-2 border-t border-sidebar-border">
		{#if currentStreak > 0}
			<div
				class="mx-2 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
			>
				<FlameIcon class="size-4 shrink-0" />
				<span class="font-medium tabular-nums">{currentStreak} day streak</span>
			</div>
		{/if}
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<ThemeToggle variant="sidebar" />
			</Sidebar.MenuItem>
		</Sidebar.Menu>
		<NavUser {user} />
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
