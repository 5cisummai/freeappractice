import { error, json, type RequestHandler } from '@sveltejs/kit';
import { isEmailDeliveryId } from '$lib/auth/email-delivery';
import { getEmailDeliveryStatus } from '$lib/server/email-delivery.server';

export const GET: RequestHandler = async ({ params }) => {
	const id = params.id?.trim();
	if (!isEmailDeliveryId(id)) throw error(404, 'Email delivery not found');

	const delivery = await getEmailDeliveryStatus(id);
	if (!delivery) throw error(404, 'Email delivery not found');

	return json(delivery);
};
