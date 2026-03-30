import { Router } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import authenticateToken from "../middleware/auth.js";
import { getFeeds, getAssetTypes } from "../controllers/feeds.controller.js";

const router = Router();

router.get('/', asyncHandler(getFeeds));
router.get('/asset-types', asyncHandler(getAssetTypes))

export default router;