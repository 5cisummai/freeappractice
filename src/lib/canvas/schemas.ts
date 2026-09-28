import { z } from 'zod';

export const generativeCanvasToolInputSchema = z.object({
	title: z.string().trim().min(1).max(200).describe('Short visible title for the interactive canvas.'),
	accessibleDescription: z
		.string()
		.trim()
		.min(1)
		.max(2_000)
		.describe('Screen-reader summary of what the canvas shows and how to use it.'),
	html: z
		.string()
		.min(1)
		.max(300_000)
		.describe('Complete self-contained HTML document with inline CSS and JavaScript only.')
});
