import { Router } from "express";
import z from "zod";

import asyncHandler from "../utils/asyncHandler.js";
import validate from "../middleware/validate.js";
import authenticateToken from "../middleware/auth.js";
import notificationsController from "../controllers/notifications.controller.js";
const { subscribe, unsubscribe, getPreferences, updatePreference, getVapidPublicKey } = notificationsController;
const router = Router();

const subscribeSchema = z.object({
	endpoint: z.url(),
	keys: z.object({
		p256dh: z.string().min(1),
		auth: z.string().min(1),
	}),
});

const unsubscribeSchema = z.object({
	endpoint: z.url()
});

const preferenceSchema = z
	.object({
		confThreshold: z.number().min(0).max(1).optional(),
		enabled: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "Provide at least one field to update",
	});

// Public — frontend needs VAPID key before user is logged in
router.get("/vapid-public-key", getVapidPublicKey);

// All others require auth
router.use(authenticateToken);

router.post("/subscribe", validate(subscribeSchema), asyncHandler(subscribe));
router.delete(
	"/unsubscribe",
	validate(unsubscribeSchema),
	asyncHandler(unsubscribe),
);
router.get("/preferences", asyncHandler(getPreferences));
router.patch(
	"/preferences/:feedId",
	validate(preferenceSchema),
	asyncHandler(updatePreference),
);

export default router;
