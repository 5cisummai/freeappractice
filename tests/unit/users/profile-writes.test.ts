import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	batch: vi.fn(),
	updateWhere: vi.fn(),
	updateSet: vi.fn(),
	update: vi.fn(),
	deleteWhere: vi.fn(),
	delete: vi.fn(),
	insertValues: vi.fn(),
	insert: vi.fn(),
	onConflictDoNothing: vi.fn()
}));

vi.mock('$lib/server/neon/db', () => ({
	getNeonDatabase: () => ({
		batch: mocks.batch,
		update: mocks.update,
		delete: mocks.delete,
		insert: mocks.insert
	})
}));

import { createUserProfile, updateUserCourses } from '$lib/users/model.server';

describe('focused user profile writes', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.update.mockReturnValue({ set: mocks.updateSet });
		mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
		mocks.delete.mockReturnValue({ where: mocks.deleteWhere });
		mocks.insert.mockReturnValue({ values: mocks.insertValues });
		mocks.insertValues.mockReturnValue({ onConflictDoNothing: mocks.onConflictDoNothing });
		mocks.batch.mockResolvedValue([]);
		mocks.onConflictDoNothing.mockResolvedValue([]);
	});

	it('creates a profile idempotently without first reading it', async () => {
		await createUserProfile('student-1');

		expect(mocks.insertValues).toHaveBeenCalledWith({ userId: 'student-1' });
		expect(mocks.onConflictDoNothing).toHaveBeenCalledOnce();
	});

	it('updates courses without loading or saving a whole profile document', async () => {
		const updateQuery = { kind: 'update-courses' };
		const deleteQuery = { kind: 'delete-courses' };
		const insertQuery = { kind: 'insert-courses' };
		mocks.updateWhere.mockReturnValueOnce(updateQuery);
		mocks.deleteWhere.mockReturnValueOnce(deleteQuery);
		mocks.insertValues.mockReturnValueOnce(insertQuery);

		await updateUserCourses('student-1', ['AP Biology', 'AP Chemistry']);

		expect(mocks.batch).toHaveBeenCalledWith([updateQuery, deleteQuery, insertQuery]);
		expect(mocks.insertValues).toHaveBeenCalledWith([
			{ userId: 'student-1', course: 'AP Biology', position: 0 },
			{ userId: 'student-1', course: 'AP Chemistry', position: 1 }
		]);
	});
});
