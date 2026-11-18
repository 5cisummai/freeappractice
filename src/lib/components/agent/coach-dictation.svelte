<script lang="ts">
	import { onMount } from 'svelte';
	import MicrophoneIcon from '@tabler/icons-svelte/icons/microphone';
	import SquareIcon from '@tabler/icons-svelte/icons/square-filled';
	import LoaderIcon from '@tabler/icons-svelte/icons/loader-2';
	import { Button } from '#lib/components/ui/button/index.js';
	import { apiFetch, getResponseMessage, readJsonOrNull } from '#lib/client/api.js';
	import { DICTATION_CREDITS_MILLI, formatCreditsFromMilli } from '#lib/agent/usage/credits.js';
	import { toast } from 'svelte-sonner';

	let {
		disabled,
		busy = $bindable(false),
		onStart,
		onText,
		onFinish
	}: {
		disabled: boolean;
		busy?: boolean;
		onStart: () => void;
		onText: (text: string) => void;
		onFinish: () => void;
	} = $props();
	let supported = $state(false);
	let recording = $state(false);
	let recorder: MediaRecorder | undefined;
	let stream: MediaStream | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let pending: AbortController | undefined;
	let generation = 0;

	onMount(() => {
		supported =
			typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
		return cancel;
	});
	function releaseMicrophone() {
		clearTimeout(timer);
		stream?.getTracks().forEach((track) => track.stop());
		stream = undefined;
		recording = false;
	}
	function cancel() {
		generation++;
		pending?.abort();
		if (recorder?.state === 'recording') recorder.stop();
		releaseMicrophone();
		busy = false;
	}
	async function start() {
		busy = true;
		onStart();
		const attempt = ++generation;
		try {
			const media = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (attempt !== generation) {
				media.getTracks().forEach((track) => track.stop());
				return;
			}
			stream = media;
			recorder = new MediaRecorder(media);
			const chunks: Blob[] = [];
			let bytes = 0;
			recorder.ondataavailable = (event) => {
				chunks.push(event.data);
				bytes += event.data.size;
				if (bytes > 2_000_000 && recorder?.state === 'recording') recorder.stop();
			};
			recorder.onerror = () => {
				cancel();
				toast.error('Could not record dictation.');
				onFinish();
			};
			recorder.onstop = () => {
				if (attempt !== generation) return;
				releaseMicrophone();
				void submit(new Blob(chunks, { type: chunks[0]?.type }), attempt);
			};
			recorder.start(500);
			recording = true;
			timer = setTimeout(() => {
				if (recorder?.state === 'recording') recorder.stop();
			}, 45_000);
		} catch {
			if (attempt !== generation) return;
			cancel();
			toast.error('Allow microphone access to dictate a message.');
			onFinish();
		}
	}
	async function submit(audio: Blob, attempt: number) {
		pending = new AbortController();
		try {
			if (!audio.size || audio.size > 2_200_000)
				throw new Error('Please dictate a shorter message.');
			const base64 = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result).split(',')[1]);
				reader.onerror = () => reject(new Error('Could not read dictation.'));
				reader.readAsDataURL(audio);
			});
			if (attempt !== generation) return;
			const response = await apiFetch('/api/coach/dictate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ audio: base64 }),
				signal: pending.signal
			});
			const payload = await readJsonOrNull<{ text?: string; error?: string }>(response);
			if (!response.ok)
				throw new Error(getResponseMessage(payload, 'Could not transcribe dictation. Try again.'));
			if (attempt !== generation) return;
			if (!payload?.text?.trim()) throw new Error('No speech detected. Try again.');
			onText(payload.text.trim());
		} catch (error) {
			if (attempt === generation)
				toast.error(error instanceof Error ? error.message : 'Dictation failed.');
		} finally {
			if (attempt === generation) {
				busy = false;
				onFinish();
			}
		}
	}
</script>

{#if supported}
	<Button
		type="button"
		variant="ghost"
		size="icon-sm"
		class="size-8 rounded-full"
		disabled={disabled || (busy && !recording)}
		onclick={() => (recording ? recorder?.stop() : start())}
		aria-label={recording
			? 'Finish dictation'
			: busy
				? 'Transcribing dictation'
				: 'Dictate a message'}
		title={recording
			? 'Finish dictation'
			: `Dictate a message (${formatCreditsFromMilli(DICTATION_CREDITS_MILLI)} credits per session)`}
		aria-pressed={recording}
	>
		{#if recording}<SquareIcon class="size-4 text-destructive" />{:else if busy}<LoaderIcon
				class="size-4 animate-spin motion-reduce:animate-none"
			/>{:else}<MicrophoneIcon class="size-4" />{/if}
	</Button>
{/if}
