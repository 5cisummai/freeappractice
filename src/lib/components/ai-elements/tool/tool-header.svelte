<script lang="ts">
	import { CollapsibleTrigger } from '$lib/components/ui/collapsible/index.js';
	import { cn } from '$lib/utils';

	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import FolderIcon from '@lucide/svelte/icons/folder';

	type ToolUIPartType = string;
	type ToolUIPartState =
		'input-streaming' | 'input-available' | 'output-available' | 'output-error';

	interface ToolHeaderProps {
		type: ToolUIPartType;
		state: ToolUIPartState;
		class?: string;
		[key: string]: unknown;
	}

	let { type, state, class: className = '', ...restProps }: ToolHeaderProps = $props();

	let statusLabel = $derived(
		(
			{
				'input-streaming': 'Pending',
				'input-available': 'Running',
				'output-available': 'Completed',
				'output-error': 'Error'
			} as const
		)[state]
	);

	let id = $props.id();
</script>

<CollapsibleTrigger
	{id}
	class={cn(
		'group flex w-fit max-w-full items-center gap-2 rounded-md px-1 py-1 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
		className
	)}
	{...restProps}
>
	<FolderIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
	<span class="min-w-0 truncate font-normal">{type}</span>
	<span class="sr-only">{statusLabel}</span>
	<ChevronDownIcon
		class="size-4 shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[state=open]:rotate-180 group-data-[state=open]:opacity-100"
		aria-hidden="true"
	/>
</CollapsibleTrigger>
