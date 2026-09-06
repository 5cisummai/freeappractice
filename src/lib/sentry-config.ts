import { building, dev } from '$app/environment';

const sentryEnabled = !dev && !building;

export const sentryOptions = {
	dsn: 'https://232093562e45ef93e51f60c4e90108db@o4511759649472512.ingest.us.sentry.io/4511759658909696',
	enabled: sentryEnabled,
	tracesSampleRate: 1,
	enableLogs: true
};

export { sentryEnabled };
