import * as Sentry from '@sentry/sveltekit';
import { sentryEnabled, sentryOptions } from '#lib/sentry-ignore.js';

if (sentryEnabled) {
	Sentry.init(sentryOptions);
}
