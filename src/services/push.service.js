import webpush from "web-push";

webpush.setVapidDetails(
	process.env.VAPID_EMAIL,
	process.env.VAPID_PUBLIC_KEY,
	process.env.VAPID_PRIVATE_KEY,
);

/**
 * Send a push notification to a single subscription.
 * Returns true on success, false on failure (expired/invalid sub).
 */
export const sendPush = async (subscription, payload) => {
	try {
		await webpush.sendNotification(
			{
				endpoint: subscription.endpoint,
				keys: {
					p256dh: subscription.keys.p256dh,
					auth: subscription.keys.auth,
				},
			},
			JSON.stringify(payload),
		);
		return true;
	} catch (err) {
		// 404 / 410 means the subscription is expired or unregistered
		if (err.statusCode === 404 || err.statusCode === 410) {
			return "expired";
		}
		console.error("[push] Send failed:", err.message);
		return false;
	}
};

/**
 * Broadcast to multiple subscriptions, auto-clean expired ones.
 * Returns count of successful sends.
 */
export const broadcast = async (subscriptions, payload, onExpired) => {
	let sent = 0;
	await Promise.allSettled(
		subscriptions.map(async (sub) => {
			const result = await sendPush(sub, payload);
			if (result === "expired" && onExpired) {
				await onExpired(sub.endpoint);
			}
			if (result === true) sent++;
		}),
	);
	return sent;
};


