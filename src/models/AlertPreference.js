import mongoose from "mongoose";

const alertPreferenceSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		feedId: { type: String, required: true },
		confThreshold: { type: Number, default: 0.05 }, // 5% conf/price ratio
		enabled: { type: Boolean, default: true },
		lastAlertedAt: { type: Date, default: null },
	},
	{ timestamps: true },
);

alertPreferenceSchema.index({ userId: 1, feedId: 1 }, { unique: true });

const AlertPreference = mongoose.model("AlertPreference", alertPreferenceSchema);

export default AlertPreference;