<script lang="ts" module>
	import { tv, type VariantProps } from 'tailwind-variants';

	export const tabsListVariants = tv({
		base: 'rounded-lg p-[3px] group-data-horizontal/tabs:h-9 data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col',
		variants: {
			variant: {
				default: 'cn-tabs-list-variant-default bg-muted',
				line: 'cn-tabs-list-variant-line gap-1 bg-transparent'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	});

	export type TabsListVariant = VariantProps<typeof tabsListVariants>['variant'];
</script>

<script lang="ts">
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let indicator = $state({
		x: '0px',
		y: '0px',
		width: '0px',
		height: '0px'
	});

	function updateIndicator(list: HTMLElement) {
		const activeTrigger = list.querySelector<HTMLElement>('[data-state="active"]');

		if (!activeTrigger) return;

		const listRect = list.getBoundingClientRect();
		const triggerRect = activeTrigger.getBoundingClientRect();

		indicator = {
			x: `${triggerRect.left - listRect.left}px`,
			y: `${triggerRect.top - listRect.top}px`,
			width: `${triggerRect.width}px`,
			height: `${triggerRect.height}px`
		};
	}

	let {
		ref = $bindable(null),
		variant = 'default',
		class: className,
		...restProps
	}: TabsPrimitive.ListProps & {
		variant?: TabsListVariant;
	} = $props();

	$effect(() => {
		const list = ref as HTMLElement | null;

		if (!list) return;

		const handleResize = () => updateIndicator(list);
		const resizeObserver = new ResizeObserver(handleResize);
		const mutationObserver = new MutationObserver(handleResize);

		updateIndicator(list);
		resizeObserver.observe(list);
		mutationObserver.observe(list, {
			attributes: true,
			subtree: true,
			attributeFilter: ['data-state']
		});
		window.addEventListener('resize', handleResize);

		return () => {
			resizeObserver.disconnect();
			mutationObserver.disconnect();
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<TabsPrimitive.List
	bind:ref
	data-slot="tabs-list"
	data-variant={variant}
	style={`--tabs-indicator-x: ${indicator.x}; --tabs-indicator-y: ${indicator.y}; --tabs-indicator-width: ${indicator.width}; --tabs-indicator-height: ${indicator.height};`}
	class={cn(
		tabsListVariants({ variant }),
		"relative before:pointer-events-none before:absolute before:top-0 before:left-0 before:z-0 before:h-[var(--tabs-indicator-height)] before:w-[var(--tabs-indicator-width)] before:translate-x-[var(--tabs-indicator-x)] before:translate-y-[var(--tabs-indicator-y)] before:rounded-md before:bg-background before:opacity-0 before:shadow-sm before:transition-[transform,width,height,opacity] before:duration-300 before:ease-[cubic-bezier(0.22,1,0.36,1)] before:content-[''] after:pointer-events-none after:absolute after:z-0 after:bg-foreground after:opacity-0 after:transition-[transform,width,height,opacity] after:duration-300 after:ease-[cubic-bezier(0.22,1,0.36,1)] after:content-[''] data-[orientation=horizontal]:after:bottom-0 data-[orientation=horizontal]:after:left-0 data-[orientation=horizontal]:after:h-0.5 data-[orientation=horizontal]:after:w-[var(--tabs-indicator-width)] data-[orientation=horizontal]:after:translate-x-[var(--tabs-indicator-x)] data-[orientation=vertical]:after:top-0 data-[orientation=vertical]:after:right-0 data-[orientation=vertical]:after:h-[var(--tabs-indicator-height)] data-[orientation=vertical]:after:w-0.5 data-[orientation=vertical]:after:translate-y-[var(--tabs-indicator-y)] data-[variant=default]:before:opacity-100 data-[variant=line]:after:opacity-100 motion-reduce:before:transition-none motion-reduce:after:transition-none",
		className
	)}
	{...restProps}
/>
