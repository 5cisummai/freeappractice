import type { RequestHandler } from './$types';
import { handleEveTool } from '#lib/agent/eve-tools.server.js';

export const config = { maxDuration: 60 };

export const POST: RequestHandler = handleEveTool;
