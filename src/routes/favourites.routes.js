import { Router } from "express";
import z, { symbol } from "zod";

import asyncHandler from "../utils/asyncHandler.js";
import validate from "../middleware/validate.js";
import authenticateToken from "../middleware/auth.js";
import { getFavourites, addFavourite, removeFavourite, isFavourited } from "../controllers/favourites.controller.js";

const router = Router();

const addFavSchema = z.object({
	feedId: z.string().min(1, "feedId is required"),
	symbol: z.string().optional()
});

router.use(authenticateToken);

router.get("/", asyncHandler(getFavourites));
router.post("/", validate(addFavSchema), asyncHandler(addFavourite));
router.delete("/:feedId", asyncHandler(removeFavourite));
router.get("/:feedId", asyncHandler(isFavourited));

export default router;