import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid request', issues: err.issues });
      }
      return res.status(400).json({ error: 'Invalid request' });
    }
  };
}