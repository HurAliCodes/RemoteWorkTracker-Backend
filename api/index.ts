import type { IncomingMessage, ServerResponse } from 'http';
import app from '../src/app';

// Vercel injects environment variables at runtime, so we must NOT call
// app.listen() here. Instead we export the Express app as the request
// handler. Vercel's @vercel/node runtime will invoke it per request.
export default function handler(req: IncomingMessage, res: ServerResponse) {
	return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
