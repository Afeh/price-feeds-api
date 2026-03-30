import PriceFeed from "../models/PriceFeed.js";

// GET /api/feeds?search=BTC&assetType=Crypto&limit=20
const getFeeds = async (req, res) => {
	const { search, assetType, limit = 20, page = 1 } = req.query;

	const query = {};

	if (search) {
		query.$or = [
			{ symbol: { $regex: search, $options: "i" } },
			{ displaySymbol: { $regex: search, $options: "i" } },
		];
	}

	if (assetType) {
		query.assetType = assetType;
	}

	const skip = (Number(page) - 1) * Number(limit);
	const total = await PriceFeed.countDocuments(query);
	const feeds = await PriceFeed.find(query)
		.sort({ lastSyncedAt: -1 })
		.skip(skip)
		.limit(Number(limit));

	res.json({
		status: "success",
		total,
		page: Number(page),
		pages: Math.ceil(total / Number(limit)),
		data: feeds,
	});
};

const getAssetTypes = async (req, res) => {
	const types = await PriceFeed.distinct("assetType");
	res.json({ status: "success", data: types.filter(Boolean).sort() });
};

export { getFeeds, getAssetTypes };
