import { Router } from "express";
import z from "zod";

import {
	register,
	login,
	refresh,
	logout,
	getUser,
} from "../controllers/auth.controller.js";
import validate from "../middleware/validate.js";
import asyncHandler from "../utils/asyncHandler.js";
import authenticateToken from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
	email: z.email({ message: "Invalid email address" }),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
	email: z.email({ message: "Invalid email address" }),
	password: z.string().min(1),
});


router.post('/register', validate(registerSchema), asyncHandler(register));
router.post('/login', validate(loginSchema),    asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));
router.get('/me', authenticateToken, asyncHandler(getUser));

export default router;