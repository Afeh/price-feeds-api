import FavouriteModel from "../models/Favourite.js";
import PriceFeed from "../models/PriceFeed.js";
import AlertPreference from "../models/AlertPreference.js";
import ApiError from "../utils/apiError.js";

const getFavourites = async (req, res) => {
	const favourites = await FavouriteModel.find({ userId: req.user.id }).sort({
		createdAt: -1,
	});
	res.json({ status: "success", count: favourites.length, data: favourites });
};

const addFavourite = async (req, res) => {
	const { feedId, symbol } = req.body;

	const feed = await PriceFeed.findOne({ feedId });
	if (!feed) throw new ApiError(404, "Price feed not found");

	const favourite = await FavouriteModel.create({
		userId: req.user.id,
		feedId,
		symbol: feed.symbol,
	});

	await AlertPreference.findOneAndUpdate(
		{ userId: req.user.id, feedId },
		{
			$setOnInsert: {
				userId: req.user.id,
				feedId,
				confThreshold: 0.05,
				enabled: true,
			},
		},
		{ upsert: true, new: true },
	);

	res.status(201).json({ status: "success", data: favourite });
};

const removeFavourite = async (req, res) => {
	const { feedId } = req.params;

	const favourite = await FavouriteModel.findOneAndDelete({
		userId: req.user.id,
		feedId,
	});
	if (!favourite) throw new ApiError(404, "Favourite not found");

	await AlertPreference.findOneAndDelete({ userId: req.user.id, feedId });

	res.json({ status: "success", message: "Removed from favourites" });
};

// GET /api/favourites/:feedId — check if a single feed is favourited
const isFavourited = async (req, res) => {
	const { feedId } = req.params;
	const favourite = await FavouriteModel.findOne({ userId: req.user.id, feedId });
	res.json({ status: "success", favourited: !!favourite });
};


export { getFavourites, addFavourite, removeFavourite, isFavourited };