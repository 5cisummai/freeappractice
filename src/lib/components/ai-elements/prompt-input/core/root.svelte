<script lang="ts">
	import { cn } from '$lib/utils';
	import {
		setPromptInputTextRegistration,
		type PromptInputTextHandle
	} from '../context/text-registration.svelte.js';
	import type { Message } from '../context/types.js';

	interface Props {
		class?: string;
		clearOnSubmit?: boolean;
		onSubmit: (message: Message, event: SubmitEvent) => void | Promise<void>;
		children?: import('svelte').Snippet;
	}

	let {
		class: className,
		clearOnSubmit = true,
		onSubmit,
		children,
		...props
	}: Props = $props();

	let promptTextHandle = $state<PromptInputTextHandle | null>(null);

	setPromptInputTextRegistration({
		register: (handle) => {
			promptTextHandle = handle;
		},
		unregister: (handle) => {
			if (promptTextHandle === handle) {
				promptTextHandle = null;
			}
		}
	});

	let handleSubmit = async (event: SubmitEvent) => {
		event.preventDefault();

		let form = event.currentTarget as HTMLFormElement;
		let text =
			promptTextHandle?.getValue() ?? ((new FormData(form).get('message') as string) || '');

		await onSubmit({ text }, event);

		if (clearOnSubmit) {
			promptTextHandle?.clear();
		}
	};
</script>

<form
	class={cn('w-full overflow-hidden rounded-xl border bg-background shadow-sm', className)}
	onsubmit={handleSubmit}
	{...props}
>
	{#if children}
		{@render children()}
	{/if}
</form>
