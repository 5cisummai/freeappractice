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
	sendChangeEmailConfirmationEmail,
	sendConfirmationEmail,
	sendDeleteAccountEmail,
	sendExistingUserSignupEmail,
	sendResetEmail
} from '$lib/auth/email.server';
import { connectDb } from '$lib/server/db';
import { UserProfile } from '$lib/users/model.server';
import { ensureUserProfile } from '$lib/users/profile.server';
import { Referral } from '$lib/referrals/model.server';
import { FrqAttempt } from '$lib/frq/model.server';
import { getTrustedOrigins } from '$lib/auth/trusted-origins.server';
import { getAdminUserIds } from '$lib/auth/admin.server';
import {
	isPasswordWithinLimit,
	MAX_PASSWORD_LENGTH,
	MIN_PASSWORD_LENGTH
} from '$lib/auth/password-policy';

const db = await getMongoDb();
const client = await getMongoClient();

const authSecret =
	env.BETTER_AUTH_SECRET ?? (building ? 'build-time-placeholder-secret-min-32-chars' : undefined);
const authBaseUrl = env.BETTER_AUTH_URL;

export const auth = betterAuth({
	appName: 'Free AP Practice',
	...(authSecret ? { secret: authSecret } : {}),
	...(authBaseUrl ? { baseURL: authBaseUrl } : {}),
	database: mongodbAdapter(db, { client, transaction: false }),
	trustedOrigins: getTrustedOrigins(),
	experimental: { joins: true },
	rateLimit: {
		enabled: true,
		storage: 'database',
		customRules: {
			'/sign-in/email': { window: 60, max: 5 },
			'/sign-up/email': { window: 60, max: 3 },
			'/request-password-reset': { window: 60, max: 3 },
			'/send-verification-email': { window: 60, max: 3 }
		}
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
			enabled: true,
			sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
				await sendChangeEmailConfirmationEmail(user.email, newEmail, url);
			}
		},
		deleteUser: {
			enabled: true,
			sendDeleteAccountVerification: async ({ user, url }) => {
				await sendDeleteAccountEmail(user.email, url);
			},
			afterDelete: async (user) => {
				await connectDb();
				await Promise.all([
					UserProfile.deleteOne({ userId: user.id }),
					FrqAttempt.deleteMany({ userId: user.id }),
					Referral.deleteMany({
						$or: [{ referrerUserId: user.id }, { referredUserId: user.id }]
					})
				]);
			}
		}
	},
	account: {
		modelName: 'authAccounts',
		encryptOAuthTokens: true,
		accountLinking: {
			enabled: true,
			trustedProviders: ['google'],
			requireLocalEmailVerified: true
		}
	},
	session: {
		modelName: 'authSessions',
		freshAge: 60 * 60,
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
		minPasswordLength: MIN_PASSWORD_LENGTH,
		maxPasswordLength: MAX_PASSWORD_LENGTH,
		resetPasswordTokenExpiresIn: 15 * 60,
		revokeSessionsOnPasswordReset: true,
		password: {
			hash: async (password) => {
				if (!isPasswordWithinLimit(password)) {
					throw new Error('Password must be 72 UTF-8 bytes or fewer');
				}
				return bcrypt.hash(password, 12);
			},
			verify: async ({ password, hash }) => bcrypt.compare(password, hash)
		},
		sendResetPassword: async ({ user, url }) => {
			await sendResetEmail(user.email, url);
		},
		onExistingUserSignUp: async ({ user }) => {
			await sendExistingUserSignupEmail(user.email);
		}
	},
	emailVerification: {
		sendOnSignUp: true,
		sendOnSignIn: true,
		autoSignInAfterVerification: true,
		expiresIn: 15 * 60,
		sendVerificationEmail: async ({ user, url }) => {
			await sendConfirmationEmail(user.email, url);
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
			// Prefer Vercel's single-value client IP; multi-hop XFF is untrusted without CIDRs.
			ipAddressHeaders: ['x-real-ip', 'x-forwarded-for']
		},
		backgroundTasks: {
			handler: (promise) => {
				waitUntil(promise);
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
