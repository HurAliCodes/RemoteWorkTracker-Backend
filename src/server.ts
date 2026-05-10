import dotenv from "dotenv";
import app from "./app";
import logger from "./config/logger";

dotenv.config();
const PORT = process.env.PORT || 5000;

function validateServerEnv() {
    const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
    }
}

async function startServer() {
    try {
        validateServerEnv();
        
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
