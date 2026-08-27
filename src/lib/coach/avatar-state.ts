import type { ExpressionId } from './bloub/expressions';
import type { ShapeId } from './bloub/skins';
import type { StateId } from './bloub/states';

/** States intended for the interactive Coach avatar. */
export type CoachAvatarState = Exclude<StateId, 'swirl'>;

/** Friendly English names for the expressions exposed by the Coach component. */
export type CoachAvatarExpression =
	| 'neutral'
	| 'attentive'
	| 'surprised'
	| 'excited'
	| 'happy'
	| 'laughing'
	| 'angry'
	| 'sad'
	| 'scared'
	| 'suspicious'
	| 'confused'
	| 'curious'
	| 'proud'
	| 'shy'
	| 'unimpressed'
	| 'sleepy';

/** A block in a short, interruptible Coach sequence. Durations are in seconds. */
export type CoachAvatarBlock = {
	state: CoachAvatarState;
	duration: number;
};

export const COACH_AVATAR_SHAPE: ShapeId = 'nuage';
export const COACH_AVATAR_COLOR = 'var(--primary)';

export const COACH_EXPRESSION_IDS: Record<CoachAvatarExpression, ExpressionId> = {
	neutral: 'neutre',
	attentive: 'attentif',
	surprised: 'surpris',
	excited: 'excite',
	happy: 'heureux',
	laughing: 'hilare',
	angry: 'colere',
	sad: 'triste',
	scared: 'effraye',
	suspicious: 'mefiant',
	confused: 'confus',
	curious: 'curieux',
	proud: 'fier',
	shy: 'timide',
	unimpressed: 'blase',
	sleepy: 'somnolent'
};

/** Semantic chat events mapped to the Bloub catalogue states. */
export const COACH_AVATAR_STATES = {
	waiting: 'idle',
	thinking: 'thinking',
	encouraging: 'wink',
	aha: 'wide',
	important: 'alert',
	newMessage: 'notify',
	correction: 'exclaim',
	inactive: 'sleep',
	startingPractice: 'play',
	progress: 'orbit',
	success: 'burst',
	momentum: 'comet'
} as const satisfies Record<string, CoachAvatarState>;

/** Common one-shot sequences for chat feedback. */
export const COACH_AVATAR_MONTAGES = {
	success: [
		{ state: 'burst', duration: 2.4 },
		{ state: 'idle', duration: Number.POSITIVE_INFINITY }
	],
	correction: [
		{ state: 'exclaim', duration: 1.8 },
		{ state: 'idle', duration: Number.POSITIVE_INFINITY }
	],
	encouragement: [
		{ state: 'wink', duration: 1.6 },
		{ state: 'idle', duration: Number.POSITIVE_INFINITY }
	],
	aha: [
		{ state: 'wide', duration: 1.8 },
		{ state: 'idle', duration: Number.POSITIVE_INFINITY }
	]
} as const satisfies Record<string, readonly CoachAvatarBlock[]>;
