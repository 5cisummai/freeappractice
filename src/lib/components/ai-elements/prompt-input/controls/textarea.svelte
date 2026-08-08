<script lang="ts">
	import { cn } from '$lib/utils';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { getPromptInputTextRegistration } from '../context/text-registration.svelte.js';

	interface Props {
		ref?: HTMLTextAreaElement | null;
		class?: string;
		placeholder?: string;
		value?: string;
		onchange?: (event: Event) => void;
	}

	let {
		ref = $bindable(null),
		class: className,
		placeholder = 'What would you like to know?',
		value = $bindable(''),
		onchange,
		...props
	}: Props = $props();

	let promptTextRegistration = getPromptInputTextRegistration();

	let promptTextHandle = {
		getValue: () => value,
		clear: () => {
			value = '';
		}
	};

	$effect(() => {
		promptTextRegistration.register(promptTextHandle);

		return () => {
			promptTextRegistration.unregister(promptTextHandle);
		};
	});

	let handleKeyDown = (e: KeyboardEvent) => {
		if (e.key !== 'Enter' || e.isComposing || e.shiftKey) return;

		e.preventDefault();
		let form = (e.currentTarget as HTMLTextAreaElement).form;
		if (!form) return;

		let submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
		if (submitButton?.disabled) return;
		if (submitButton) {
			form.requestSubmit(submitButton);
			return;
		}
		form.requestSubmit();
	};
</script>

<Textarea
	bind:ref
	class={cn(
		'w-full resize-none rounded-none border-none p-3 shadow-none ring-0 outline-none',
		'field-sizing-content bg-transparent dark:bg-transparent',
		'max-h-48 min-h-10',
		'focus-visible:ring-0',
		className
	)}
	name="message"
	{onchange}
	onkeydown={handleKeyDown}
	{placeholder}
	bind:value
	{...props}
/>
