/** Sentinel value for the unit combobox when the user chooses a custom topic (not a named AP unit). */
export const CUSTOM_UNIT_VALUE = '__custom__';

export function isCustomUnit(unit: string | undefined): boolean {
	return unit === CUSTOM_UNIT_VALUE;
}

/** Stable short id for storage keys when using a custom topic. */
export function hashTopicKey(text: string): string {
	let h = 0;
	for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
	return Math.abs(h).toString(36);
}

/** Value stored with progress / APIs when the user chose a custom topic (not a fixed unit name). */
export function unitForProgress(selectedUnit: string, customTopic: string): string {
	if (isCustomUnit(selectedUnit)) {
		const t = customTopic.trim();
		return t ? `Custom: ${t.slice(0, 180)}` : 'custom';
	}
	return selectedUnit.trim() || 'all-units';
}
