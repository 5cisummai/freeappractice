import { COACH_AVATAR_COLOR, COACH_AVATAR_SHAPE } from '$lib/coach/avatar-state';
import { BotEngine } from '$lib/coach/bloub/engine';
import { EXPRESSION_BY_ID } from '$lib/coach/bloub/expressions';
import { DEMI_VIEWBOX, RAYON } from '$lib/coach/bloub/repere';
import { SHAPE_BY_ID } from '$lib/coach/bloub/skins';

function samplePipIconMark() {
	const engine = new BotEngine(RAYON);
	const shapeRadii = SHAPE_BY_ID.get(COACH_AVATAR_SHAPE)?.radii ?? null;
	const expression = EXPRESSION_BY_ID.get('neutre') ?? null;
	engine.setShape(shapeRadii, 0);
	engine.setExpression(expression, 0);
	engine.setState('idle', 0);
	return engine.sample(0, { arcSamples: 32 });
}

const frame = samplePipIconMark();

export const PIP_ICON_VIEWBOX = `${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}`;
export const PIP_ICON_BODY_PATH = frame.bodyPath;
export const PIP_ICON_EYES = frame.eyes;
export const PIP_ICON_COLOR = COACH_AVATAR_COLOR;
