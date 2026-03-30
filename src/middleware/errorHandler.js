import ApiError from "../utils/apiError.js";

const errorHandler = (err, req, res, next) => {
	if (err instanceof ApiError) {
		return res
			.status(err.statusCode)
			.json({ status: "error", message: err.message });
	}
	// Mongoose duplicate key
	if (err.code === 11000) {
		const field = Object.keys(err.keyValue)[0];
		return res
			.status(409)
			.json({ status: "error", message: `${field} already exists` });
	}
	// Mongoose validation
	if (err.name === "ValidationError") {
		const messages = Object.values(err.errors).map((e) => e.message);
		return res
			.status(400)
			.json({ status: "error", message: messages.join(", ") });
	}

	console.error(err);
	res.status(500).json({ status: "error", message: "Internal server error" });
};

export default errorHandler;
