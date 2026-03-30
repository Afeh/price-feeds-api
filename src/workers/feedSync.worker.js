import cron from "node-cron";
import axios from "axios";
import PriceFeed from "../models/PriceFeed.js";

const PYTH_BASE_URL =
	process.env.PYTH_BASE_URL || "https://hermes.pyth.network";

const syncFeeds = async () => {
	console.log("[feedSync] Starting Pyth feed catalogue sync...");
	try {
		const { data } = await axios.get(`${PYTH_BASE_URL}/v2/price_feeds`);

		if (!Array.isArray(data)) {
			console.error("[feedSync] Unexpected response shape from Pyth");
			return;
		}

		const ops = data.map((feed) => ({
			updateOne: {
				filter: { feedId: feed.id },
				update: {
					$set: {
						feedId: feed.id,
						symbol: feed.attributes?.symbol ?? feed.id,
						displaySymbol:
							feed.attributes?.display_symbol ??
							feed.attributes?.symbol ??
							"",
						assetType: feed.attributes?.asset_type ?? "Unknown",
						lastSyncedAt: new Date(),
					},
				},
				upsert: true,
			},
		}));

		const result = await PriceFeed.bulkWrite(ops);
		console.log(
			`[feedSync] Synced ${result.upsertedCount} new, ${result.modifiedCount} updated feeds`,
		);
	} catch (err) {
		console.error("[feedSync] Sync failed:", err.message);
	}
};

const feedSyncWorker = {
	start: () => {
		syncFeeds(); // immediate first run
		cron.schedule("0 0 * * *", syncFeeds); // midnight every day
	},
};

export {syncFeeds, feedSyncWorker};
