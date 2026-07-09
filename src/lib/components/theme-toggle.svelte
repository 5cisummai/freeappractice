<script lang="ts">
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import LaptopIcon from '@lucide/svelte/icons/laptop';
	import { userPrefersMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { settingsController } from '$lib/client/settings.svelte.js';
	import type { ClassValue } from 'svelte/elements';

	type Theme = 'light' | 'dark' | 'system';

	let {
		variant = 'icon',
		class: className
	}: {
		variant?: 'icon' | 'full' | 'sidebar';
		class?: ClassValue;
	} = $props();

	const theme = $derived(userPrefersMode.current);

	function onThemeChange(value: string) {
		if (value === 'light' || value === 'dark' || value === 'system') {
			settingsController.setTheme(value);
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			{#if variant === 'sidebar'}
				<Sidebar.MenuButton tooltipContent="Theme" class={className} {...props}>
					<span class="relative size-4">
						<SunIcon
							class="absolute inset-0 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
						/>
						<MoonIcon
							class="absolute inset-0 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
						/>
					</span>
					<span>Theme</span>
				</Sidebar.MenuButton>
			{:else if variant === 'full'}
				<Button {...props} variant="ghost" class={['w-full justify-start gap-2', className]}>
					<span class="relative size-4">
						<SunIcon
							class="absolute inset-0 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
						/>
						<MoonIcon
							class="absolute inset-0 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
						/>
					</span>
					Theme
				</Button>
			{:else}
				<Button {...props} variant="ghost" size="icon" class={['relative', className]}>
					<SunIcon
						class="size-[1.2rem] scale-100 rotate-0 transition-all! dark:scale-0 dark:-rotate-90"
					/>
					<MoonIcon
						class="absolute size-[1.2rem] scale-0 rotate-90 transition-all! dark:scale-100 dark:rotate-0"
					/>
					<span class="sr-only">Theme</span>
				</Button>
			{/if}
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content
		align="end"
		side={variant === 'sidebar' ? 'top' : 'bottom'}
		class="min-w-36"
	>
		<DropdownMenu.Group>
			<DropdownMenu.RadioGroup value={theme} onValueChange={onThemeChange}>
				<DropdownMenu.RadioItem value={'light' satisfies Theme}>
					<SunIcon />
					Light
				</DropdownMenu.RadioItem>
				<DropdownMenu.RadioItem value={'dark' satisfies Theme}>
					<MoonIcon />
					Dark
				</DropdownMenu.RadioItem>
				<DropdownMenu.RadioItem value={'system' satisfies Theme}>
					<LaptopIcon />
					System
				</DropdownMenu.RadioItem>
			</DropdownMenu.RadioGroup>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
