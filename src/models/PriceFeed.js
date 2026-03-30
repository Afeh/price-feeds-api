import mongoose from "mongoose";

const priceFeedSchema = new mongoose.Schema({
	feedId: { type: String, required: true, unique: true },
	symbol: { type: String, required: true },
	displaySymbol: { type: String },
	assetType: { type: String }, // Crypto, Equity, FX, Metal, etc.
	lastSyncedAt: { type: Date, default: Date.now },
});

priceFeedSchema.index({ symbol: "text", displaySymbol: "text" });

const PriceFeed = mongoose.model("PriceFeed", priceFeedSchema);

export default PriceFeed;
