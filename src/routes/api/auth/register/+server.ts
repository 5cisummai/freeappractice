import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { connectDb } from '$lib/server/db';
import { User } from '$lib/server/models/user';
import { signToken, signPendingSignupToken } from '$lib/server/auth';
import { sendConfirmationEmail } from '$lib/server/services/email';
import { generateEmailToken, MIN_PASSWORD_LENGTH } from '$lib/server/utils';
import { logger } from '$lib/server/logger';

const registerSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	email: z.string().email('Invalid email address'),
	password: z
		.string()
		.min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const parsed = registerSchema.safeParse(body);
		if (!parsed.success) {
			return json(
				{ error: parsed.error.issues[0]?.message ?? 'Validation failed' },
				{ status: 400 }
			);
		}

		const { name, password } = parsed.data;
		const email = parsed.data.email.toLowerCase().trim();

		await connectDb();

		const existing = await User.findOne({ email });
		if (existing) {
			return json({ error: 'Email already registered' }, { status: 409 });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const { emailToken, emailTokenExpires } = generateEmailToken();

		const user = new User({
			name,
			email,
			password: hashedPassword,
			verified: false,
			emailToken,
			emailTokenExpires
		});

		await user.save();
		await sendConfirmationEmail(user.email, emailToken);

		const token = signToken(user._id.toString());
		const pendingSignupToken = signPendingSignupToken(user._id.toString(), user.email);

		return json(
			{
				message: 'User registered successfully. Please verify your email before logging in.',
				token,
				pendingSignupToken,
				user: { userId: user._id, name: user.name, email: user.email }
			},
			{ status: 201 }
		);
	} catch (err) {
		logger.error('Register error', { error: err });
		return json({ error: 'Registration failed' }, { status: 500 });
	}
};
