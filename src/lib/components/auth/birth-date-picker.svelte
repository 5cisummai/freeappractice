<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { CalendarDate, getLocalTimeZone, parseDate } from '@internationalized/date';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	type Props = {
		id?: string;
		value?: string;
		min?: string;
		max?: string;
		disabled?: boolean;
		'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
		class?: string;
	};

	let {
		id,
		value = $bindable(''),
		min,
		max,
		disabled = false,
		'aria-invalid': ariaInvalid,
		class: className
	}: Props = $props();

	let open = $state(false);
	let selectedDate = $state<CalendarDate | undefined>(undefined);

	function toCalendarDate(input: string | undefined): CalendarDate | undefined {
		if (!input) return undefined;
		try {
			return parseDate(input);
		} catch {
			return undefined;
		}
	}

	const minValue = $derived(min ? toCalendarDate(min) : undefined);
	const maxValue = $derived(max ? toCalendarDate(max) : undefined);

	$effect(() => {
		selectedDate = toCalendarDate(value);
	});

	function formatDisplay(input: string): string {
		const date = toCalendarDate(input);
		if (!date) return 'Select date';
		return date.toDate(getLocalTimeZone()).toLocaleDateString();
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger {id} {disabled}>
		{#snippet child({ props })}
			<Button
				{...props}
				type="button"
				variant="outline"
				{disabled}
				aria-invalid={ariaInvalid}
				class={cn(
					'w-full justify-between font-normal',
					!value && 'text-muted-foreground',
					className
				)}
			>
				{formatDisplay(value)}
				<ChevronDownIcon />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-auto overflow-hidden p-0" align="start">
		<Calendar
			type="single"
			bind:value={selectedDate}
			captionLayout="dropdown"
			minValue={minValue}
			maxValue={maxValue}
			onValueChange={() => {
				value = selectedDate ? selectedDate.toString() : '';
				open = false;
			}}
		/>
	</Popover.Content>
</Popover.Root>
