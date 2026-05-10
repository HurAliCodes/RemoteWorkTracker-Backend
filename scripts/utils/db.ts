import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
export async function withDatabase<T>(callback: (client: Client) => Promise<T>) {
	const rawConnectionString = process.env.DATABASE_URL;
	const shouldUseSsl =
		process.env.DB_SSL === '1' ||
		process.env.DB_SSL === 'true' ||
		(process.env.PGSSLMODE || '').toLowerCase() === 'require' ||
		(rawConnectionString ? new URL(rawConnectionString).searchParams.get('sslmode') === 'require' : false);

	// Railway's proxy commonly needs SSL with certificate verification disabled in Node.
	// Also, pg may derive SSL settings from `sslmode` inside the URL; we strip it so our `ssl` option wins.
	const connectionString = rawConnectionString
		? (() => {
				const u = new URL(rawConnectionString);
				u.searchParams.delete('sslmode');
				return u.toString();
			})()
		: undefined;

	const client = connectionString
		? new Client({
				connectionString,
				ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
			})
		: new Client({
				host: process.env.DB_HOST,
				port: Number(process.env.DB_PORT),
				database: process.env.DB_NAME,
				user: process.env.DB_USER,
				password: process.env.DB_PASSWORD,
				ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
			});
    try {
        await client.connect();
        return await callback(client);
    } catch (err) {
        console.error('Database operation failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}