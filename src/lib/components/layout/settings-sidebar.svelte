<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import ArrowLeftIcon from '@tabler/icons-svelte/icons/arrow-left';
	import BookIcon from '@tabler/icons-svelte/icons/book-filled';
	import PaletteIcon from '@tabler/icons-svelte/icons/palette-filled';
	import ShieldIcon from '@tabler/icons-svelte/icons/shield-filled';
	import SparklesIcon from '@tabler/icons-svelte/icons/sparkles-filled';
	import UserIcon from '@tabler/icons-svelte/icons/user-filled';
	import AdjustmentsIcon from '@tabler/icons-svelte/icons/adjustments-filled';
	import InfoIcon from '@tabler/icons-svelte/icons/info-circle-filled';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { useSidebar } from '#lib/components/ui/sidebar/context.svelte.js';

	const sections = [
		{ id: 'practice', label: 'Practice', icon: BookIcon },
		{ id: 'appearance', label: 'Appearance', icon: PaletteIcon },
		{ id: 'privacy', label: 'Privacy', icon: ShieldIcon },
		{ id: 'super', label: 'Super', icon: SparklesIcon },
		{ id: 'account', label: 'Account', icon: UserIcon },
		{ id: 'advanced', label: 'Advanced', icon: AdjustmentsIcon },
		{ id: 'about', label: 'About', icon: InfoIcon }
	];
	let hash = $state('practice');
	let reduceMotion = $state(false);
	const sidebar = useSidebar();
	function syncHash() {
		hash = window.location.hash.slice(1) || 'practice';
	}
	onMount(() => {
		syncHash();
		reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	});
</script>

<svelte:window onhashchange={syncHash} />
<Sidebar.Root collapsible="offcanvas" variant="inset">
	<div class="flex h-full flex-col" in:fly={{ x: -12, duration: reduceMotion ? 0 : 180 }}>
		<Sidebar.Header>
			<a
				href={resolve('app')}
				class="flex h-10 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
			>
				<ArrowLeftIcon class="size-4" /> Back to app
			</a>
		</Sidebar.Header>
		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupLabel>Settings</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each sections as { id, label, icon: Icon } (id)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									isActive={page.url.pathname === resolve('app/settings') && hash === id}
								>
									{#snippet child({ props })}
										<a
											href={resolve(`app/settings#${id}`)}
											onclick={() => sidebar.setOpenMobile(false)}
											{...props}
										>
											<Icon aria-hidden="true" />
											<span>{label}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>
	</div>
</Sidebar.Root>
