import cron from "node-cron";
import AlertPreference from "../models/AlertPreference.js";
import PushSubscription from "../models/PushSubscription.js";
import PriceFeed from "../models/PriceFeed.js";

import { getLatestPrices, calcConfRatio } from "../services/pyth.service.js";
import broadcast from "../services/push.service.js";

const COOLDOWN_MS =
	(Number(process.env.CONF_ALERT_COOLDOWN_MINUTES) || 10) * 60 * 1000;
const BATCH_SIZE = 100; // Pyth handles up to 100 ids per request comfortably

const runMonitor = async () => {
	try {
		// 1. Fetch all enabled alert preferences
		const prefs = await AlertPreference.find({ enabled: true });
		if (!prefs.length) return;

		// 2. Deduplicate feedIds and batch-fetch prices from Pyth
		const uniqueFeedIds = [...new Set(prefs.map((p) => p.feedId))];
		const allPrices = [];

		for (let i = 0; i < uniqueFeedIds.length; i += BATCH_SIZE) {
			const batch = uniqueFeedIds.slice(i, i + BATCH_SIZE);
			const prices = await getLatestPrices(batch);
			allPrices.push(...prices);
		}

		// 3. Build a quick lookup map: feedId → parsed price object
		const priceMap = new Map(allPrices.map((p) => [p.id, p]));

		// 4. Group prefs by feedId for efficient processing
		const prefsByFeed = prefs.reduce((acc, pref) => {
			if (!acc[pref.feedId]) acc[pref.feedId] = [];
			acc[pref.feedId].push(pref);
			return acc;
		}, {});

		// 5. For each feed, check thresholds and fire alerts
		for (const [feedId, feedPrefs] of Object.entries(prefsByFeed)) {
			const parsed = priceMap.get(feedId);
			if (!parsed) continue;

			const confRatio = calcConfRatio(parsed);
			if (confRatio === null) continue;

			const now = Date.now();

			for (const pref of feedPrefs) {
				// Skip if conf ratio is below user's threshold
				if (confRatio < pref.confThreshold) continue;

				// Skip if within cooldown window
				const lastAlerted = pref.lastAlertedAt
					? new Date(pref.lastAlertedAt).getTime()
					: 0;
				if (now - lastAlerted < COOLDOWN_MS) continue;

				// Fetch user's push subscriptions
				const subscriptions = await PushSubscription.find({
					userId: pref.userId,
				});
				if (!subscriptions.length) continue;

				// Build human-readable notification payload
				const feedMeta = await PriceFeed.findOne({ feedId }).lean();
				const symbol =
					feedMeta?.displaySymbol || feedMeta?.symbol || feedId;
				const confPercent = (confRatio * 100).toFixed(2);

				const payload = {
					title: `⚠️ Confidence Alert: ${symbol}`,
					body: `Confidence interval hit ${confPercent}% of price — above your ${(pref.confThreshold * 100).toFixed(2)}% threshold.`,
					data: {
						feedId,
						confRatio,
						timestamp: new Date().toISOString(),
					},
				};

				// Broadcast and auto-clean expired subscriptions
				const sent = await broadcast(
					subscriptions,
					payload,
					async (expiredEndpoint) => {
						await PushSubscription.findOneAndDelete({
							endpoint: expiredEndpoint,
						});
						console.log(
							`[monitor] Cleaned expired subscription for user ${pref.userId}`,
						);
					},
				);

				if (sent > 0) {
					// Update cooldown timestamp
					await AlertPreference.findByIdAndUpdate(pref._id, {
						$set: { lastAlertedAt: new Date() },
					});
					console.log(
						`[monitor] Alert sent to user ${pref.userId} for ${symbol} (conf ${confPercent}%)`,
					);
				}
			}
		}
	} catch (err) {
		console.error("[monitor] Worker error:", err.message);
	}
};

const priceMonitorWorker = {
	start: () => {
		const interval = process.env.PRICE_MONITOR_INTERVAL_SECONDS || 60;
		console.log(`[monitor] Starting price monitor (every ${interval}s)`);
		cron.schedule(`*/${interval} * * * * *`, runMonitor);
	},
};


export { priceMonitorWorker };