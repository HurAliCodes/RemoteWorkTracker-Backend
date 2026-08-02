import dotenv from "dotenv";
import app from "./app";
import logger from "./config/logger";
import { assertRequiredEnv } from "./config/env";
import { getCorsOptions } from "./config/cors";
import { startScheduledJobs } from "./jobs/scheduler";
import { initRateLimitRedis } from "./middleware/rateLimit.middleware";

dotenv.config();
const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        assertRequiredEnv();
        getCorsOptions();
        await initRateLimitRedis();
        startScheduledJobs();
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });
    } catch (error) {
        logger.error("Failed to start server:", error);
        process.exit(1);
    }
}


process.on("unhandledRejection", (err) => {
    logger.error("Unhandled Promise Rejection:", err);
    process.exit(1);
});


process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception:", err);
    process.exit(1);
});

startServer();
