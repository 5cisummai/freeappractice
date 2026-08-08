import { randomUUID } from 'node:crypto';
import { referrals } from '$lib/server/neon/schema';
import { model, type PostgresModel } from '$lib/server/neon/model';

export interface IReferral {
	_id: string;
	referrerUserId: string;
	referredUserId: string;
	activatedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
	save: () => Promise<unknown>;
}

export const Referral: PostgresModel<IReferral> = model<IReferral>({
	table: referrals as any,
	columns: referrals as any,
	idField: 'id',
	prepareInsert: async (input) => ({ ...input, id: input.id ?? randomUUID() })
});
