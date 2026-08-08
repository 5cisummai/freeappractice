import Message from './core/message.svelte';
import MessageContent from './core/message-content.svelte';
import MessageActions from './actions/message-actions.svelte';
import MessageAction from './actions/message-action.svelte';
import MessageResponse from './response/message-response.svelte';

export {
	Message,
	MessageContent,
	MessageActions,
	MessageAction,
	MessageResponse,

	// Aliases
	Message as Root,
	MessageContent as Content,
	MessageActions as Actions,
	MessageAction as Action,
	MessageResponse as Response
};
