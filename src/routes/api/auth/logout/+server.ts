import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// JWT is stateless - logout is handled client-side by discarding the token.
// This endpoint exists for API compatibility and can be used for audit logging.
export const POST: RequestHandler = async () => {
	return json({ message: 'Logged out successfully' });
};
