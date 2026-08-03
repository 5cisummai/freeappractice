import * as Sentry from '@sentry/sveltekit';
import { sentryOptions } from '$lib/sentry-config';

Sentry.init(sentryOptions);
