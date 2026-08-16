<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import CompassIcon from '@lucide/svelte/icons/compass';
	import BarChart3Icon from '@lucide/svelte/icons/bar-chart-3';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import BrainCircuitIcon from '@lucide/svelte/icons/brain-circuit';
	import UsersIcon from '@lucide/svelte/icons/users';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import type { Component } from 'svelte';

	type NavHref =
		| '/app'
		| '/app/practice'
		| '/app/progress'
		| '/app/resources'
		| '/app/coach'
		| '/app/insights'
		| '/app/members'
		| '/app/materials'
		| '/app/admin';

	type NavItem = {
		href: NavHref;
		label: string;
		icon: Component;
	};

	let {
		assistantFeaturesEnabled = true,
		showMembers = false,
		isAdmin = false
	}: {
		assistantFeaturesEnabled?: boolean;
		showMembers?: boolean;
		isAdmin?: boolean;
	} = $props();

	const overviewItems: NavItem[] = [
		{ href: '/app', label: 'Dashboard', icon: LayoutDashboardIcon }
	];

	const practiceItems: NavItem[] = [
		{ href: '/app/practice', label: 'Practice', icon: BookOpenIcon },
		{ href: '/app/progress', label: 'Progress', icon: BarChart3Icon },
		{ href: '/app/resources', label: 'Resources', icon: CompassIcon }
	];

	const superItems = $derived.by((): NavItem[] => {
		if (!assistantFeaturesEnabled) return [];

		return [
			{ href: '/app/coach', label: 'Coach', icon: BrainCircuitIcon },
			{ href: '/app/insights', label: 'Insights', icon: SparklesIcon }
		];
	});

	const organizationItems = $derived.by((): NavItem[] => {
		const items: NavItem[] = [];

		if (showMembers) {
			items.push({ href: '/app/materials', label: 'Materials', icon: LayersIcon });
			items.push({ href: '/app/members', label: 'Members', icon: UsersIcon });
		}

		if (isAdmin) {
			items.push({ href: '/app/admin', label: 'Admin', icon: ShieldIcon });
		}

		return items;
	});

	const navGroups = $derived(
		[
			{ label: 'Overview', items: overviewItems },
			{ label: 'Practice', items: practiceItems },
			superItems.length > 0 ? { label: 'Super AI', items: superItems } : null,
			organizationItems.length > 0 ? { label: 'Organization', items: organizationItems } : null
		].filter((group): group is { label: string; items: NavItem[] } => group !== null)
	);

	function isActive(href: NavHref): boolean {
		const resolved = resolve(href);
		if (href === '/app') return page.url.pathname === resolved;
		return page.url.pathname === resolved || page.url.pathname.startsWith(resolved + '/');
	}
</script>

{#each navGroups as group (group.label)}
	<Sidebar.Group>
		<Sidebar.GroupLabel>{group.label}</Sidebar.GroupLabel>
		<Sidebar.GroupContent>
			<Sidebar.Menu>
				{#each group.items as item (item.href)}
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
{/each}
