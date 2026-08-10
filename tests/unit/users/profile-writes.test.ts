import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	batch: vi.fn(),
	updateReturning: vi.fn(),
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

import {
	createUserProfile,
	ensureUserReferralCode,
	updateUserSubjects
} from '$lib/users/model.server';

describe('focused user profile writes', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.update.mockReturnValue({ set: mocks.updateSet });
		mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
		mocks.updateWhere.mockReturnValue({ returning: mocks.updateReturning });
		mocks.delete.mockReturnValue({ where: mocks.deleteWhere });
		mocks.insert.mockReturnValue({ values: mocks.insertValues });
		mocks.insertValues.mockReturnValue({ onConflictDoNothing: mocks.onConflictDoNothing });
		mocks.batch.mockResolvedValue([]);
		mocks.onConflictDoNothing.mockResolvedValue([]);
	});

	it('creates a profile idempotently without first reading it', async () => {
		await createUserProfile('student-1');

		expect(mocks.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'student-1', referralCode: expect.any(String) })
		);
		expect(mocks.onConflictDoNothing).toHaveBeenCalledOnce();
	});

	it('updates subjects without loading or saving a whole profile document', async () => {
		const updateQuery = { kind: 'update-subjects' };
		const deleteQuery = { kind: 'delete-subjects' };
		const insertQuery = { kind: 'insert-subjects' };
		mocks.updateWhere.mockReturnValueOnce(updateQuery);
		mocks.deleteWhere.mockReturnValueOnce(deleteQuery);
		mocks.insertValues.mockReturnValueOnce(insertQuery);

		await updateUserSubjects('student-1', ['AP Biology', 'AP Chemistry']);

		expect(mocks.batch).toHaveBeenCalledWith([updateQuery, deleteQuery, insertQuery]);
		expect(mocks.insertValues).toHaveBeenCalledWith([
			{ userId: 'student-1', subject: 'AP Biology', position: 0 },
			{ userId: 'student-1', subject: 'AP Chemistry', position: 1 }
		]);
	});

	it('atomically returns the existing or newly assigned referral code', async () => {
		mocks.updateReturning.mockResolvedValueOnce([{ referralCode: 'stable-code' }]);

		await expect(ensureUserReferralCode('student-1')).resolves.toBe('stable-code');
		expect(mocks.updateReturning).toHaveBeenCalledOnce();
	});

	it('fails clearly when the user profile does not exist', async () => {
		mocks.updateReturning.mockResolvedValueOnce([]);

		await expect(ensureUserReferralCode('missing-user')).rejects.toThrow('User profile not found');
	});
});
