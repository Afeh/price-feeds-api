import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import errorHandler from "./src/middleware/errorHandler.js";
import authRoutes from "./src/routes/auth.routes.js";
import favRoutes from "./src/routes/favourites.routes.js";
import feedRoutes from "./src/routes/feeds.routes.js";
import notifRoutes from "./src/routes/notifications.routes.js";

const app = express();

app.use(
	cors({
		origin: true, // This reflects the request origin, essentially allowing any single origin while still supporting credentials
		credentials: true,
	}),
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/favourites", favRoutes);
app.use("/api/feeds", feedRoutes);
app.use("/api/notifications", notifRoutes);

app.get("/health", (req, res) => {
	res.json({ status: "ok", uptime: process.uptime() });
});

// 404
app.use((req, res) =>
	res.status(404).json({ status: "error", message: "Route not found" }),
);

// Central error handler
app.use(errorHandler);

export default app;
