<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.png';
	import NavUser from '$lib/components/layout/nav-user.svelte';
	import OrgSwitcher from '$lib/components/layout/org-switcher.svelte';
	import ThemeToggle from '$lib/components/layout/theme-toggle.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';

	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CompassIcon from '@lucide/svelte/icons/compass';
	import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import BrainCircuitIcon from '@lucide/svelte/icons/brain-circuit';
	import type { UserOrganization } from '$lib/auth/organization-types';

	let {
		isAdmin,
		user,
		assistantFeaturesEnabled = true,
		organizations = [],
		activeOrganization = null,
		ownedGroupCount = 0
	}: {
		isAdmin: boolean;
		user: { name: string; email: string; image?: string | null };
		assistantFeaturesEnabled?: boolean;
		organizations?: UserOrganization[];
		activeOrganization?: UserOrganization | null;
		ownedGroupCount?: number;
	} = $props();

	const baseNavItems = [
		{ href: '/app', label: 'Dashboard', icon: LayoutDashboardIcon },
		{ href: '/app/practice', label: 'Practice', icon: BookOpenIcon },
		{ href: '/app/progress', label: 'Progress', icon: BarChart3Icon },
		{ href: '/app/resources', label: 'Resources', icon: CompassIcon },
		{ href: '/app/coach', label: 'Coach', icon: BrainCircuitIcon },
		{ href: '/app/insights', label: 'Insights', icon: SparklesIcon }
	] as const;

	const adminNavItem = { href: '/app/admin', label: 'Admin', icon: ShieldIcon } as const;
	const navItems = $derived([
		...baseNavItems.filter(
			(item) =>
				assistantFeaturesEnabled || (item.href !== '/app/coach' && item.href !== '/app/insights')
		),
		...(isAdmin ? [adminNavItem] : [])
	]);

	function isActive(href: (typeof navItems)[number]['href'] | '/app/settings'): boolean {
		const resolved = resolve(href);
		if (href === '/app') return page.url.pathname === resolved;
		return page.url.pathname === resolved || page.url.pathname.startsWith(resolved + '/');
	}
</script>

<Sidebar.Root collapsible="offcanvas" variant="inset">
	<Sidebar.Header class="justify-center gap-1">
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
		<OrgSwitcher {organizations} {activeOrganization} {ownedGroupCount} />
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
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

	<Sidebar.Footer class="border-t border-sidebar-border">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					isActive={isActive('/app/settings')}
					tooltipContent="Settings"
					class="data-active:bg-primary/10 data-active:font-medium data-active:text-primary"
				>
					{#snippet child({ props })}
						<a
							href={resolve('/app/settings')}
							aria-current={isActive('/app/settings') ? 'page' : undefined}
							{...props}
						>
							<SettingsIcon />
							<span>Settings</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
			<Sidebar.MenuItem>
				<ThemeToggle variant="sidebar" />
			</Sidebar.MenuItem>
		</Sidebar.Menu>
		<NavUser {user} />
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
