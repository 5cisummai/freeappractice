import * as Sentry from '@sentry/sveltekit';
import { sentryEnabled, sentryOptions } from '#lib/sentry-config.js';

if (sentryEnabled) {
	Sentry.init(sentryOptions);
}
