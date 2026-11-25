export const AP_SCORE_BANDS = [1, 2, 3, 4, 5] as const;

export const BIOLOGY_SCORE_REFERENCE =
	'https://apcentral.collegeboard.org/media/pdf/ap-biology-practice-exam-2013.pdf';

export function estimateBiologyScore(input: {
	mcqCorrect: number;
	mcqTotal: number;
	frqEarned: number;
	frqAvailable: number;
}): (typeof AP_SCORE_BANDS)[number] | null {
	const { mcqCorrect, mcqTotal, frqEarned, frqAvailable } = input;
	const mcq = mcqCorrect / mcqTotal;
	const frq = frqEarned / frqAvailable;
	if (![mcq, frq].every((ratio) => Number.isFinite(ratio) && ratio >= 0 && ratio <= 1)) {
		return null;
	}

	// Biology gives each section half of the composite. The 2013 worksheet
	// converts a rounded, 120-point composite to the five score bands.
	const composite = Math.round(mcq * 60 + frq * 60);
	if (composite >= 93) return 5;
	if (composite >= 75) return 4;
	if (composite >= 54) return 3;
	if (composite >= 30) return 2;
	return 1;
}
