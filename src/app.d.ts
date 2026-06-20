import type { Session, User } from 'better-auth/db';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

interface ImportMetaEnv {
	/** Google OAuth client ID for One Tap sign-in on login/signup pages. */
	readonly PUBLIC_GOOGLE_CLIENT_ID?: string;
}

declare global {
	interface ImportMeta {
		readonly env: ImportMetaEnv;
	}
	namespace App {
		// interface Error {}
		interface Locals {
			userId?: string;
			user?: User;
			session?: Session;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		googleScriptInitialized?: boolean;
		google?: {
			accounts: {
				id: {
					initialize: (config: {
						client_id: string;
						callback: (response: { credential: string }) => void;
						use_fedcm_for_prompt?: boolean;
						itp_support?: boolean;
						cancel_on_tap_outside?: boolean;
						context?: 'signin' | 'signup' | 'use';
						auto_select?: boolean;
					}) => void;
					prompt: (callback?: (notification: GoogleOneTapPromptNotification) => void) => void;
					cancel: () => void;
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

	interface GoogleOneTapPromptNotification {
		isDismissedMoment?: () => boolean;
		getDismissedReason?: () => string;
		isSkippedMoment?: () => boolean;
	}
}

export {};
