/**
 * Object keys for images stored in the public R2 bucket.
 * Upload with: pnpm assets:upload <local-file> <key>
 */
export const publicPageAssets = {
	about: {
		missionPlanning: 'pages/about/mission-planning.jpg',
		studyWorkspace: 'pages/about/study-workspace.jpg'
	},
	blog: {
		'which-aps-to-take': 'pages/blog/which-aps-to-take.jpg',
		'summer-ap-study-plan': 'pages/blog/summer-ap-study-plan.jpg',
		'science-of-studying': 'pages/blog/science-of-studying.jpg',
		'subject-specific': 'pages/blog/subject-specific.jpg',
		'stop-studying-harder': 'pages/blog/stop-studying-harder.jpg'
	}
} as const;
