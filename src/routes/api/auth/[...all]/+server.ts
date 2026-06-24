import { auth } from '$lib/auth/server';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import type { RequestHandler } from './$types';

const handler = toSvelteKitHandler(auth);

export const GET: RequestHandler = handler;
export const POST: RequestHandler = handler;
export const PATCH: RequestHandler = handler;
export const PUT: RequestHandler = handler;
export const DELETE: RequestHandler = handler;
