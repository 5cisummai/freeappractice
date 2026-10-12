import { z } from 'zod';

export const generativeCanvasToolInputSchema = z.object({
	title: z
		.string()
		.trim()
		.min(1)
		.max(200)
		.describe('Short visible title for the interactive canvas.'),
	description: z
		.string()
		.trim()
		.min(1)
		.max(8_000)
		.describe(
			'Detailed simulation brief: learning objective, AP course/topic, physical or mathematical model, initial values, units, controls and their ranges, visual behavior, and student instructions. Include all relevant conversation context; the generator only sees this brief and the title.'
		)
});
