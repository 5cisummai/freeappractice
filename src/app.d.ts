// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

interface ImportMetaEnv {
	/** Optional; set in `.env` when using Cloudflare Web Analytics beacon in `+layout.svelte`. */
	readonly PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			userId: string | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		google?: {
			accounts: {
				id: {
					initialize: (config: {
						client_id: string;
						callback: (response: { credential: string }) => void;
					}) => void;
					prompt: () => void;
					renderButton: (
						parent: HTMLElement,
						options: {
							type?: string;
							theme?: string;
							size?: string;
							width?: string | number;
							text?: string;
						}
					) => void;
				};
			};
		};
	}
}

export {};
