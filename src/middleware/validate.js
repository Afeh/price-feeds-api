import z from "zod";
import ApiError from "../utils/apiError.js";

const validate = (schema) => (req, res, next) => {
	try {
		const result = schema.safeParse(req.body);

		if (!result.success) {
			// result.error.issues is more reliable in newer Zod versions than .errors
			const message = result.error.issues
				.map((e) => `${e.path.join(".")} - ${e.message}`)
				.join(", ");

			// Pass the error to next() instead of throwing
			return next(new ApiError(400, `Validation error: ${message}`));
		}

		req.body = result.data;
		next();
	} catch (error) {
		next(error);
	}
};

export default validate;
