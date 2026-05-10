import rateLimit from 'express-rate-limit';
export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 10, 
  message: {
    error: 'Too many login attempts, please try again after a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    error: 'Too many password reset requests, please try again after a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const resetPasswordRateLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 5, 
  message: {
    error: 'Too many reset attempts, please try again after a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 5, 
  message: {
    error: 'Too many registration attempts, please try again after a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests, please try again after a minute.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
