import { flag } from 'flags/sveltekit';

export const customTopicEnabled = flag<boolean>({
	key: 'custom-topic',
	description: 'Allow users to enter a custom topic when generating practice questions',
	options: [
		{ value: false, label: 'Disabled' },
		{ value: true, label: 'Enabled' }
	],
	decide() {
		return false;
	}
});
