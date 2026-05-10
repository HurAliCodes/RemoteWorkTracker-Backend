import { createLogger, format, transports } from "winston";
import type { transport } from "winston";

const { combine, timestamp, printf, colorize, errors } = format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}] : ${stack || message}`;
});

// On serverless platforms (Vercel, AWS Lambda, etc.) the filesystem is
// read-only outside of /tmp. Winston's File transport tries to create
// the destination file synchronously when it is constructed, which
// throws EROFS / ENOENT and crashes the function on cold start
// ("FUNCTION_INVOCATION_FAILED"). We therefore disable file transports
// in those environments and rely on the console transport, whose output
// is captured by the platform log aggregator.
const isServerless =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    process.env.DISABLE_FILE_LOGS === "1" ||
    process.env.DISABLE_FILE_LOGS === "true";

const loggerTransports: transport[] = [
    new transports.Console({
        format: combine(colorize(), timestamp(), logFormat),
    }),
];

if (!isServerless) {
    loggerTransports.push(
        new transports.File({
            filename: "logs/error.log",
            level: "error",
        }),
        new transports.File({
            filename: "logs/combined.log",
        }),
    );
}

const logger = createLogger({
    level: "info",
    format: combine(timestamp(), errors({ stack: true }), logFormat),
    transports: loggerTransports,
});

export default logger;
