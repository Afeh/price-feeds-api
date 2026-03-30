import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../utils/apiError.js";

const signAccess = (payload) =>
	jwt.sign(payload, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN || "15m",
	});

const signRefresh = (payload) =>
	jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
		expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
	});

const cookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "strict",
	maxAge: 21 * 24 * 60 * 60 * 1000,
};

const register = async (req, res) => {
	const { email, password } = req.body;

	const existing = await User.findOne({ email });
	if (existing) throw new ApiError(409, "Email already in use");

	const user = await User.create({ email, password });

	const payload = { id: user._id, email: user.email };
	const accessToken = signAccess(payload);
	const refreshToken = signRefresh(payload);

	// Persist hashed refresh token
	user.refreshToken = refreshToken;
	await user.save({ validateBeforeSave: true });

	res.cookie("refreshToken", refreshToken, cookieOptions);

	res.status(201).json({
		status: "success",
		accessToken,
		user: { id: user._id, email: user.email },
	});
};

const login = async (req, res) => {
	const { email, password } = req.body;

	const user = await User.findOne({ email }).select(
		"+password +refreshToken",
	);
	if (!user) throw new ApiError(401, "Invalid email or password");

	const valid = await user.comparePassword(password);
	if (!valid) throw new ApiError(401, "Invalid email or password");

	const payload = { id: user._id, email: user.email };
	const accessToken = signAccess(payload);
	const refreshToken = signRefresh(payload);

	user.refreshToken = refreshToken;
	await user.save({ validateBeforeSave: false });

	res.cookie("refreshToken", refreshToken, cookieOptions);

	res.json({
		status: "success",
		accessToken,
		user: { id: user._id, email: user.email },
	});
};

const refresh = async (req, res) => {
	const token = req.cookies?.refreshToken;
	if (!token) throw new ApiError(401, "Refresh token missing");

	let decoded;
	try {
		decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
	} catch {
		throw new ApiError(403, "Invalid or expired refresh token");
	}

	const user = await User.findById(decoded.id).select("+refreshToken");
	if (!user || user.refreshToken !== token) {
		throw new ApiError(403, "Refresh token reuse detected");
	}

	// Rotate — issue both new tokens
	const payload = { id: user._id, email: user.email };
	const accessToken = signAccess(payload);
	const refreshToken = signRefresh(payload);

	user.refreshToken = refreshToken;
	await user.save({ validateBeforeSave: false });

	res.cookie("refreshToken", refreshToken, cookieOptions);

	res.json({ status: "success", accessToken });
};

const logout = async (req, res) => {
	const token = req.cookies?.refreshToken;

	if (token) {
		const user = await User.findOne({ refreshToken: token }).select(
			"+refreshToken",
		);
		if (user) {
			user.refreshToken = null;
			await user.save({ validateBeforeSave: false });
		}
	}

	res.clearCookie("refreshToken", cookieOptions);
	res.json({ status: "success", message: "Logged out" });
};

const getUser = async (req, res) => {
	const user = await User.findById(req.user.id);
	if (!user) throw new ApiError(404, "User not found");
	res.json({ status: "success", user: { id: user._id, email: user.email } });
};


export { register, login, refresh, logout, getUser };