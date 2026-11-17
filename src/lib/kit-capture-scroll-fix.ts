import type { Plugin } from 'vite';

/**
 * Workaround for https://github.com/sveltejs/kit/issues/17500 until Kit
 * ships a patch. `capture_scroll` assigns into `history_info[index]` and
 * throws when that slot is missing, which leaves the client router stuck.
 */
export const KIT_CAPTURE_SCROLL_ASSIGNMENT = 'history_info[index].scroll = scroll_state();';

export const KIT_CAPTURE_SCROLL_SAFE_ASSIGNMENT =
	'(history_info[index] ??= {}).scroll = scroll_state();';

export function isSvelteKitClientRuntime(id: string): boolean {
	const path = id.split('?')[0]?.replaceAll('\\', '/') ?? '';
	return path.endsWith('/@sveltejs/kit/src/runtime/client/client.js');
}

export const KIT_CAPTURE_SCROLL_MISSING_NEEDLE_WARNING =
	'SvelteKit capture_scroll() no longer matches kitCaptureScrollFix; check whether https://github.com/sveltejs/kit/issues/17500 is fixed and remove the plugin';

export function applyKitCaptureScrollFix(code: string): {
	code: string;
	patched: boolean;
	alreadySafe: boolean;
} {
	const alreadySafe = code.includes(KIT_CAPTURE_SCROLL_SAFE_ASSIGNMENT);
	if (!code.includes(KIT_CAPTURE_SCROLL_ASSIGNMENT)) {
		return { code, patched: false, alreadySafe };
	}

	return {
		code: code.replaceAll(KIT_CAPTURE_SCROLL_ASSIGNMENT, KIT_CAPTURE_SCROLL_SAFE_ASSIGNMENT),
		patched: true,
		alreadySafe
	};
}

export function transformKitCaptureScroll(
	code: string,
	id: string
): { code: string; map: null } | { warn: string } | undefined {
	if (!isSvelteKitClientRuntime(id)) return;

	const result = applyKitCaptureScrollFix(code);
	if (result.patched) {
		return { code: result.code, map: null };
	}
	if (!result.alreadySafe) {
		return { warn: KIT_CAPTURE_SCROLL_MISSING_NEEDLE_WARNING };
	}
}

/** Vite `pre` plugin. Add before `sveltekit()` and remove once Kit 3.1.x patches this. */
export function kitCaptureScrollFix(): Plugin {
	return {
		name: 'kit-capture-scroll-fix',
		enforce: 'pre',
		transform(code, id) {
			const result = transformKitCaptureScroll(code, id);
			if (!result) return;
			if ('warn' in result) {
				this.warn(result.warn);
				return;
			}
			return result;
		}
	};
}
