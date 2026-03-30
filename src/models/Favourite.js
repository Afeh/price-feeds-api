import mongoose from "mongoose";

const favouriteSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		feedId: { type: String, required: true }, // Pyth hex feed ID
		symbol: { type: String, required: true }, // e.g. "Crypto.BTC/USD"
	},
	{ timestamps: true },
);

favouriteSchema.index({ userId: 1, feedId: 1 }, { unique: true });

const FavouriteModel = mongoose.model("Favourite", favouriteSchema);

export default FavouriteModel;
