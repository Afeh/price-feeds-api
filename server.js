import dotenv from 'dotenv';
dotenv.config()
import app from "./app.js";
import connectDB from "./src/config/db.js";

import { feedSyncWorker } from './src/workers/feedSync.worker.js';
import { priceMonitorWorker } from './src/workers/priceMonitor.worker.js';

const PORT = process.env.PORT || 5000;

(async () => {
	await connectDB();

	// Boot background workers
	feedSyncWorker.start();
	priceMonitorWorker.start();

	app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
