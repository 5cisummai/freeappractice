import {
	HalftoneCmykTypes,
	ShaderFitOptions,
	ShaderMount,
	getShaderColorFromString,
	getShaderNoiseTexture,
	halftoneCmykFragmentShader,
	type ShaderMountUniforms
} from '@paper-design/shaders';

const LIGHT_BACK = '#fbfaf4';
const DARK_BACK = '#080b14';

export const HALFTONE_FRAGMENT_SHADER = halftoneCmykFragmentShader;

function waitForImage(image: HTMLImageElement): Promise<HTMLImageElement | null> {
	if (image.complete) return Promise.resolve(image.naturalWidth > 0 ? image : null);

	return new Promise((resolve) => {
		const onLoad = () => resolve(image.naturalWidth > 0 ? image : null);
		const onError = () => resolve(null);
		image.addEventListener('load', onLoad, { once: true });
		image.addEventListener('error', onError, { once: true });
	});
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
	const image = new Image();
	image.src = src;
	return waitForImage(image);
}

export async function loadHalftoneUniforms(
	imageSrc: string,
	isDark: boolean
): Promise<ShaderMountUniforms | null> {
	const noiseSource = getShaderNoiseTexture();
	if (!noiseSource) return null;

	const [heroImage, noiseTexture] = await Promise.all([
		loadImage(imageSrc),
		waitForImage(noiseSource)
	]);
	if (!heroImage || !noiseTexture) return null;

	return {
		u_image: heroImage,
		u_noiseTexture: noiseTexture,
		u_colorBack: getShaderColorFromString(isDark ? DARK_BACK : LIGHT_BACK),
		u_colorC: getShaderColorFromString('#2563eb'),
		u_colorM: getShaderColorFromString('#8b5cf6'),
		u_colorY: getShaderColorFromString('#f4b740'),
		u_colorK: getShaderColorFromString('#1e3a8a'),
		u_size: 0.12,
		u_gridNoise: 0.08,
		u_type: HalftoneCmykTypes.ink,
		u_softness: 0.65,
		u_contrast: 1.05,
		u_floodC: 0.15,
		u_floodM: 0,
		u_floodY: 0,
		u_floodK: 0,
		u_gainC: 0.18,
		u_gainM: 0.08,
		u_gainY: 0.1,
		u_gainK: 0.04,
		u_grainMixer: 0.02,
		u_grainOverlay: 0.03,
		u_grainSize: 0.5,
		u_fit: ShaderFitOptions.cover,
		u_scale: 1,
		u_rotation: 0,
		u_originX: 0.5,
		u_originY: 0.5,
		u_offsetX: 0,
		u_offsetY: 0,
		u_worldWidth: 0,
		u_worldHeight: 0
	};
}

/** ShaderMount prepends a canvas before program linking; remove it if construction throws. */
export function discardFailedShaderCanvas(parent: HTMLElement): void {
	parent.querySelector(':scope > canvas')?.remove();
}

/**
 * Paper Shaders calls getAttribLocation even when compile/link left `program` null.
 * Catch that TypeError so the static hero image can remain visible.
 */
export function tryCreateShaderMount(
	parent: HTMLElement,
	uniforms: ShaderMountUniforms
): ShaderMount | null {
	try {
		return new ShaderMount(
			parent,
			HALFTONE_FRAGMENT_SHADER,
			uniforms,
			undefined,
			0,
			0,
			1,
			undefined,
			['u_image']
		);
	} catch {
		discardFailedShaderCanvas(parent);
		return null;
	}
}
