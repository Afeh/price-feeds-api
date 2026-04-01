import axios from "axios";

const BASE_URL = process.env.PYTH_BASE_URL || "https://hermes.pyth.network";

// Fetch latest prices for a batch of feedIds in one request
const getLatestPrices = async (feedIds) => {
	if (!feedIds.length) return [];

	// Pyth accepts repeated ids[] params
	const params = new URLSearchParams();
	feedIds.forEach((id) => params.append("ids[]", id));

	const { data } = await axios.get(
		`${BASE_URL}/v2/updates/price/latest?${params.toString()}&parsed=true`,
	);

	// Returns array of parsed price objects
	return data?.parsed ?? [];
};

/**
 * Calculate confidence ratio: conf / |price|
 * Both price and conf are integers scaled by 10^expo
 * So the ratio is just conf / |price| regardless of expo
 */
const calcConfRatio = (parsedFeed) => {
	const price = Math.abs(Number(parsedFeed.price.price));
	const conf = Number(parsedFeed.price.conf);
	if (price === 0) return null;
	return conf / price;
};

export {
	getLatestPrices,
	calcConfRatio
};
