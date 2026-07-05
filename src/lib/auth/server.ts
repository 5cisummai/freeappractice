import { betterAuth } from 'better-auth/minimal';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { oneTap } from 'better-auth/plugins';
import { admin } from 'better-auth/plugins/admin';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { waitUntil } from '@vercel/functions';
import { building } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import bcrypt from 'bcryptjs';
import { getMongoClient, getMongoDb } from '$lib/server/mongo-native';
import {
	sendConfirmationEmail,
	sendExistingUserSignupEmail,
	sendResetEmail
} from '$lib/auth/email.server';
import { connectDb } from '$lib/server/db';
import { UserProfile } from '$lib/users/model.server';
import { ensureUserProfile } from '$lib/users/profile.server';
import { getTrustedOrigins } from '$lib/auth/trusted-origins.server';
import { getAdminUserIds } from '$lib/auth/admin.server';

const db = await getMongoDb();
const client = await getMongoClient();

const authSecret =
	env.BETTER_AUTH_SECRET ?? (building ? 'build-time-placeholder-secret-min-32-chars' : undefined);
const authBaseUrl = env.BETTER_AUTH_URL;

function runAuthBackgroundTask(promise: Promise<unknown>): void {
	try {
		waitUntil(promise);
	} catch {
		void promise.catch((err) => console.error('Background auth task failed:', err));
	}
}

export const auth = betterAuth({
	appName: 'Free AP Practice',
	...(authSecret ? { secret: authSecret } : {}),
	...(authBaseUrl ? { baseURL: authBaseUrl } : {}),
	database: mongodbAdapter(db, { client, transaction: false }),
	trustedOrigins: getTrustedOrigins(),
	experimental: { joins: true },
	rateLimit: {
		enabled: true,
		storage: 'database'
	},
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					await ensureUserProfile(user.id);
				}
			}
		}
	},
	user: {
		modelName: 'authUsers',
		changeEmail: {
			enabled: true
		},
		deleteUser: {
			enabled: true,
			afterDelete: async (user) => {
				await connectDb();
				await UserProfile.deleteOne({ userId: user.id });
			}
		}
	},
	account: {
		modelName: 'authAccounts',
		encryptOAuthTokens: true
	},
	session: {
		modelName: 'authSessions',
		cookieCache: {
			enabled: true,
			maxAge: 300,
			strategy: 'compact'
		}
	},
	verification: {
		modelName: 'authVerifications'
	},
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		minPasswordLength: 8,
		resetPasswordTokenExpiresIn: 15 * 60,
		revokeSessionsOnPasswordReset: true,
		password: {
			hash: async (password) => bcrypt.hash(password, 12),
			verify: async ({ password, hash }) => bcrypt.compare(password, hash)
		},
		sendResetPassword: async ({ user, url }) => {
			runAuthBackgroundTask(sendResetEmail(user.email, url));
		},
		onExistingUserSignUp: async ({ user }) => {
			runAuthBackgroundTask(sendExistingUserSignupEmail(user.email));
		}
	},
	emailVerification: {
		sendOnSignUp: true,
		sendOnSignIn: true,
		autoSignInAfterVerification: true,
		expiresIn: 60 * 60 * 24,
		sendVerificationEmail: async ({ user, url }) => {
			runAuthBackgroundTask(sendConfirmationEmail(user.email, url));
		}
	},
	socialProviders:
		env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET
					}
				}
			: undefined,
	advanced: {
		ipAddress: {
			ipAddressHeaders: ['x-forwarded-for', 'x-real-ip']
		},
		backgroundTasks: {
			handler: (promise) => {
				try {
					waitUntil(promise);
				} catch {
					void promise.catch((err) => console.error('Background auth task failed:', err));
				}
			}
		}
	},
	plugins: [
		...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? [oneTap()] : []),
		admin({
			adminUserIds: getAdminUserIds()
		}),
		sveltekitCookies(getRequestEvent)
	]
});
