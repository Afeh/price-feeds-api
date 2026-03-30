import PushSubscription from "../models/PushSubscription.js";
import AlertPreference from "../models/AlertPreference.js";
import FavouriteModel from "../models/Favourite.js";
import ApiError from "../utils/apiError.js";

// ── Push subscription ──────────────────────────────────────────────────────

// POST /api/notifications/subscribe
const subscribe = async (req, res) => {
	const { endpoint, keys } = req.body;

	await PushSubscription.findOneAndUpdate(
		{ endpoint },
		{ $set: { userId: req.user.id, endpoint, keys } },
		{ upsert: true, new: true },
	);

	res.status(201).json({
		status: "success",
		message: "Subscribed to push notifications",
	});
};

// DELETE /api/notifications/unsubscribe
const unsubscribe = async (req, res) => {
	const { endpoint } = req.body;
	await PushSubscription.findOneAndDelete({ userId: req.user.id, endpoint });
	res.json({ status: "success", message: "Unsubscribed" });
};

// ── Alert preferences ──────────────────────────────────────────────────────

// GET /api/notifications/preferences
const getPreferences = async (req, res) => {
	const prefs = await AlertPreference.find({ userId: req.user.id });
	res.json({ status: "success", count: prefs.length, data: prefs });
};

// PATCH /api/notifications/preferences/:feedId
const updatePreference = async (req, res) => {
	const { feedId } = req.params;
	const { confThreshold, enabled } = req.body;

	// Must be a favourited feed
	const favourite = await FavouriteModel.findOne({
		userId: req.user.id,
		feedId,
	});
	if (!favourite) throw new ApiError(404, "Feed not in your favourites");

	const update = {};
	if (confThreshold !== undefined) {
		if (confThreshold < 0 || confThreshold > 1) {
			throw new ApiError(400, "confThreshold must be between 0 and 1");
		}
		update.confThreshold = confThreshold;
	}
	if (enabled !== undefined) update.enabled = enabled;

	const pref = await AlertPreference.findOneAndUpdate(
		{ userId: req.user.id, feedId },
		{ $set: update },
		{ new: true, upsert: true },
	);

	res.json({ status: "success", data: pref });
};

// GET /api/notifications/vapid-public-key
// Frontend needs this to create a push subscription via the browser API
const getVapidPublicKey = (req, res) => {
	res.json({ status: "success", key: process.env.VAPID_PUBLIC_KEY });
};

export default {
	subscribe,
	unsubscribe,
	getPreferences,
	updatePreference,
	getVapidPublicKey,
};
