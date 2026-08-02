import rateLimit from 'express-rate-limit';
import { createClient, type RedisClientType } from 'redis';
import { ENV } from '../config/env';
import logger from '../config/logger';

let redisClient: RedisClientType | null = null;

/** Optional: call from server boot when REDIS_URL is set (multi-instance rate limits). */
export async function initRateLimitRedis(): Promise<void> {
	const url = ENV.REDIS_URL.trim();
	if (!url || redisClient) return;
	try {
		redisClient = createClient({ url });
		redisClient.on('error', (err) =>
			logger.warn('[rate-limit] Redis error', { error: String(err) })
		);
		await redisClient.connect();
		logger.info('[rate-limit] Redis connected for rate limiting');
	} catch (err) {
		redisClient = null;
		logger.warn('[rate-limit] Redis unavailable; using in-memory limits', {
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

function buildLimiter(opts: { windowMs: number; max: number; message: string }) {
	const windowSec = Math.max(1, Math.ceil(opts.windowMs / 1000));
	return rateLimit({
		windowMs: opts.windowMs,
		max: opts.max,
		message: { error: opts.message },
		standardHeaders: true,
		legacyHeaders: false,
		validate: { ip: false },
		store: {
			async increment(key: string) {
				if (!redisClient?.isOpen) {
					// Fallback handled by express-rate-limit MemoryStore when store methods throw —
					// provide a tiny local counter map for this process instead.
					return localIncrement(key, windowSec);
				}
				const redisKey = `rl:${key}`;
				const count = await redisClient.incr(redisKey);
				if (count === 1) await redisClient.expire(redisKey, windowSec);
				const ttl = await redisClient.ttl(redisKey);
				return {
					totalHits: count,
					resetTime: new Date(Date.now() + Math.max(ttl, 1) * 1000),
				};
			},
			async decrement(key: string) {
				if (!redisClient?.isOpen) {
					localDecrement(key);
					return;
				}
				await redisClient.decr(`rl:${key}`);
			},
			async resetKey(key: string) {
				if (!redisClient?.isOpen) {
					localReset(key);
					return;
				}
				await redisClient.del(`rl:${key}`);
			},
		},
	});
}

const localHits = new Map<string, { count: number; resetAt: number }>();

function localIncrement(key: string, windowSec: number) {
	const now = Date.now();
	const row = localHits.get(key);
	if (!row || row.resetAt <= now) {
		const resetAt = now + windowSec * 1000;
		localHits.set(key, { count: 1, resetAt });
		return { totalHits: 1, resetTime: new Date(resetAt) };
	}
	row.count += 1;
	return { totalHits: row.count, resetTime: new Date(row.resetAt) };
}

function localDecrement(key: string) {
	const row = localHits.get(key);
	if (row && row.count > 0) row.count -= 1;
}

function localReset(key: string) {
	localHits.delete(key);
}

export const loginRateLimiter = buildLimiter({
	windowMs: 60 * 1000,
	max: 10,
	message: 'Too many login attempts, please try again after a minute.',
});

export const forgotPasswordRateLimiter = buildLimiter({
	windowMs: 60 * 1000,
	max: 5,
	message: 'Too many password reset requests, please try again after a minute.',
});

export const resetPasswordRateLimiter = buildLimiter({
	windowMs: 60 * 1000,
	max: 5,
	message: 'Too many reset attempts, please try again after a minute.',
});

export const registerRateLimiter = buildLimiter({
	windowMs: 60 * 1000,
	max: 5,
	message: 'Too many registration attempts, please try again after a minute.',
});

export const apiRateLimiter = buildLimiter({
	windowMs: 60 * 1000,
	max: 120,
	message: 'Too many requests, please try again after a minute.',
});

export const refreshRateLimiter = buildLimiter({
	windowMs: 60 * 1000,
	max: 30,
	message: 'Too many refresh attempts, please try again after a minute.',
});

export const agentRegisterRateLimiter = buildLimiter({
	windowMs: 60 * 1000,
	max: 20,
	message: 'Too many agent registration attempts, please try again after a minute.',
});

export const aiHeavyRateLimiter = buildLimiter({
	windowMs: 60 * 1000,
	max: 20,
	message: 'Too many AI report requests, please try again after a minute.',
});
