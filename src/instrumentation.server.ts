import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: 'https://232093562e45ef93e51f60c4e90108db@o4511759649472512.ingest.us.sentry.io/4511759658909696',

	tracesSampleRate: 1.0,

	// Enable logs to be sent to Sentry
	enableLogs: true

	// uncomment the line below to enable Spotlight (https://spotlightjs.com)
	// spotlight: import.meta.env.DEV,
});
