<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import HomeIconComponent from '@tabler/icons-svelte/icons/home-filled';
	import BookOpenIconComponent from '@tabler/icons-svelte/icons/book-filled';
	import BarChart3IconComponent from '@tabler/icons-svelte/icons/chart-pie-filled';
	import ShieldIconComponent from '@tabler/icons-svelte/icons/shield-filled';
	import SparklesIconComponent from '@tabler/icons-svelte/icons/sparkles-filled';
	import UsersIconComponent from '@tabler/icons-svelte/icons/user-filled';
	import LayersIconComponent from '@tabler/icons-svelte/icons/stack-filled';
	import PipIcon from '$lib/components/coach/pip-icon.svelte';
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

	const HomeIcon = HomeIconComponent as unknown as Component;
	const BookOpenIcon = BookOpenIconComponent as unknown as Component;
	const BarChart3Icon = BarChart3IconComponent as unknown as Component;
	const ShieldIcon = ShieldIconComponent as unknown as Component;
	const SparklesIcon = SparklesIconComponent as unknown as Component;
	const PipNavIcon = PipIcon as unknown as Component;
	const UsersIcon = UsersIconComponent as unknown as Component;
	const LayersIcon = LayersIconComponent as unknown as Component;

	let {
		assistantFeaturesEnabled = true,
		showMembers = false,
		isAdmin = false
	}: {
		assistantFeaturesEnabled?: boolean;
		showMembers?: boolean;
		isAdmin?: boolean;
	} = $props();

	const overviewItems = $derived.by((): NavItem[] => {
		const items: NavItem[] = [{ href: '/app', label: 'Home', icon: HomeIcon }];
		if (assistantFeaturesEnabled) {
			items.push({ href: '/app/coach', label: 'Ask Pip', icon: PipNavIcon });
		}
		return items;
	});

	const practiceItems = $derived.by((): NavItem[] => {
		const items: NavItem[] = [
			{ href: '/app/practice', label: 'Practice', icon: BookOpenIcon },
			{ href: '/app/progress', label: 'Progress', icon: BarChart3Icon }
		];
		if (assistantFeaturesEnabled) {
			items.push({ href: '/app/insights', label: 'Insights', icon: SparklesIcon });
		}
		return items;
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
