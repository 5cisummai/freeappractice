import { env } from '$env/dynamic/private';

type ModelEnvironmentVariable =
	| 'GENERATION_MODEL'
	| 'FRQ_GENERATION_MODEL'
	| 'TUTOR_MODEL'
	| 'COACH_MODEL'
	| 'INSIGHTS_MODEL'
	| 'FRQ_GRADING_MODEL'
	| 'QUESTION_QUALITY_MODEL';

function modelFromEnv(name: ModelEnvironmentVariable, fallback: string): string {
	return env[name]?.trim() || fallback;
}

const generationModel = modelFromEnv('GENERATION_MODEL', 'gpt-5.6-luna');
const tutorModel = modelFromEnv('TUTOR_MODEL', 'gpt-5.4-mini');

/**
 * The single model map for every AI task in the application.
 * Environment variables remain supported for deployment-specific overrides.
 */
export const AI_MODELS = {
	questionGeneration: generationModel,
	frqGeneration: modelFromEnv('FRQ_GENERATION_MODEL', generationModel),
	frqGrading: modelFromEnv('FRQ_GRADING_MODEL', generationModel),
	tutor: tutorModel,
	coach: modelFromEnv('COACH_MODEL', tutorModel),
	insights: modelFromEnv('INSIGHTS_MODEL', generationModel),
	questionQuality: modelFromEnv('QUESTION_QUALITY_MODEL', 'gpt-5.6-luna'),
	questionQualityCalibrated: env.QUESTION_QUALITY_CALIBRATED_MODEL?.trim() || null
} as const;

export type AIModelUseCase = keyof typeof AI_MODELS;

export function requireExplicitSuperModel(useCase: 'coach' | 'insights'): void {
	if (env.NODE_ENV !== 'production') return;

	const environmentVariable = useCase === 'coach' ? 'COACH_MODEL' : 'INSIGHTS_MODEL';
	if (!env[environmentVariable]?.trim()) {
		throw new Error(`${environmentVariable} must be explicitly configured in production`);
	}
}
