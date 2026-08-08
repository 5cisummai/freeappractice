import Root from './core/root.svelte';
import Body from './layout/body.svelte';
import Textarea from './controls/textarea.svelte';
import Submit from './controls/submit.svelte';

export {
	Root,
	Body,
	Textarea,
	Submit,
	//
	Root as PromptInput,
	Body as PromptInputBody,
	Textarea as PromptInputTextarea,
	Submit as PromptInputSubmit
};

export type { Message, Message as PromptInputMessage, ChatStatus } from './context/types.js';
