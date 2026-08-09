import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tutorProfileClasses, tutorProfiles, tutorTargetDates } from '$lib/server/neon/schema';

const mocks = vi.hoisted(() => ({
	batch: vi.fn(),
	select: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	insert: vi.fn(),
	findOne: vi.fn(),
	profileSave: vi.fn(),
	writes: [] as Array<Record<string, unknown>>
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		batch: mocks.batch,
		select: mocks.select,
		update: mocks.update,
		delete: mocks.delete,
		insert: mocks.insert
	})
}));
vi.mock('$lib/super/models.server', () => ({
	TutorProfile: {
		findOne: mocks.findOne,
		create: vi.fn(),
		exists: vi.fn()
	},
	InsightReport: { updateMany: vi.fn() }
}));
vi.mock('$lib/flags', () => ({ isSuperFreeBetaEnabled: vi.fn(async () => true) }));

import { updateTutorProfile } from '$lib/super/profile.server';

function query(kind: string, table: unknown) {
	const value: Record<string, unknown> = { kind, table };
	mocks.writes.push(value);
	return value;
}

describe('tutor profile persistence', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.writes.length = 0;
		mocks.findOne.mockReturnValue({
			exec: vi.fn().mockResolvedValue({
				_id: 'user-1',
				userId: 'user-1',
				mem0UserId: 'memory-1',
				selectedApClasses: [],
				targetDates: [],
				studyAvailability: '',
				teachingStyle: 'socratic',
				memoryEnabled: true,
				createdAt: new Date('2026-01-01T00:00:00.000Z'),
				updatedAt: new Date('2026-01-01T00:00:00.000Z'),
				save: mocks.profileSave
			})
		});
		mocks.select.mockImplementation(() => ({
			from: (table: unknown) => ({
				where: () =>
					table === tutorProfileClasses
						? { orderBy: vi.fn().mockResolvedValue([]) }
						: Promise.resolve([])
			})
		}));
		mocks.update.mockImplementation((table: unknown) => {
			const result = query('update', table);
			result.set = (values: unknown) => {
				result.values = values;
				return result;
			};
			result.where = () => result;
			return result;
		});
		mocks.delete.mockImplementation((table: unknown) => {
			const result = query('delete', table);
			result.where = () => result;
			return result;
		});
		mocks.insert.mockImplementation((table: unknown) => {
			const result = query('insert', table);
			result.values = (values: unknown) => {
				result.valuesArg = values;
				return result;
			};
			return result;
		});
		mocks.batch.mockResolvedValue([]);
	});

	it('updates the parent and replaces both relation sets in one batch', async () => {
		const result = await updateTutorProfile('user-1', {
			selectedApClasses: ['AP Biology', 'AP Chemistry'],
			targetDates: [{ apClass: 'AP Biology', targetDate: '2027-05-10' }],
			studyAvailability: 'Weeknights'
		});

		const [writes] = mocks.batch.mock.calls[0] as [Array<Record<string, unknown>>];
		expect(writes.map((write) => write.table)).toEqual([
			tutorProfiles,
			tutorProfileClasses,
			tutorProfileClasses,
			tutorTargetDates,
			tutorTargetDates
		]);
		expect(mocks.profileSave).not.toHaveBeenCalled();
		expect(result.selectedApClasses).toEqual(['AP Biology', 'AP Chemistry']);
		expect(result.studyAvailability).toBe('Weeknights');
	});
});
