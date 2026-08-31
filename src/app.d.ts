import type { Session, User } from 'better-auth/db';
import type { PlanAccess, TutorProfileView } from '$lib/super/types';
import type { OrgType } from '$lib/auth/organization-types';

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
			session?: Session & { activeOrganizationId?: string | null };
			tutorProfileView?: Promise<TutorProfileView>;
			planAccess?: Promise<PlanAccess>;
			assistantFeaturesEnabled?: Promise<boolean>;
			activeOrganizationType?: OrgType;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		googleScriptInitialized?: boolean;
		google?: {
			accounts?: {
				id?: {
					cancel?: () => void;
				};
			};
		};
	}
}

export {};
