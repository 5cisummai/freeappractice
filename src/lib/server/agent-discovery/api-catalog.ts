import { absoluteUrl } from './site';

export function buildApiCatalog(requestUrl?: URL) {
	const anchor = absoluteUrl('/api', requestUrl);

	return {
		linkset: [
			{
				anchor,
				'service-desc': [
					{
						href: absoluteUrl('/openapi.json', requestUrl),
						type: 'application/json'
					}
				],
				'service-doc': [
					{
						href: absoluteUrl('/llms.txt', requestUrl),
						type: 'text/plain'
					}
				],
				status: [
					{
						href: absoluteUrl('/health', requestUrl),
						type: 'application/json'
					}
				]
			}
		]
	};
}
