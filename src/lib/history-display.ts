import type { HistoryItem } from '$lib/users/types.js';

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: 'medium',
	timeStyle: 'short'
});

export function formatAttemptDate(attemptedAt: string): string {
	if (!attemptedAt) return '';
	return dateFormatter.format(new Date(attemptedAt));
}

export function formatTimeTaken(ms?: number): string | null {
	if (!ms || ms <= 0) return null;
	const seconds = Math.round(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const rem = seconds % 60;
	return rem > 0 ? `${minutes}m ${rem}s` : `${minutes}m`;
}

export function plainQuestionText(raw: string): string {
	return raw
		.replace(/\$\$[\s\S]*?\$\$/g, ' ')
		.replace(/\\\[([\s\S]*?)\\\]/g, ' ')
		.replace(/\$[^$]+\$/g, ' ')
		.replace(/[#*_`>[\]()]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function questionPreview(item: HistoryItem, maxLength = 120): string {
	const raw = item.question?.question ?? '';
	if (!raw) return 'Question unavailable';
	const plain = plainQuestionText(raw);
	if (plain.length <= maxLength) return plain;
	return `${plain.slice(0, maxLength)}…`;
}
