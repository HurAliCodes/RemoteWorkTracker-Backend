import pool from '../config/db';
import { PaginationParams, PaginationResult } from '../utils/pagination';
export interface QueryOptions {
	where?: Record<string, any>;
	orderBy?: string;
	order?: 'ASC' | 'DESC';
	page?: number;
	limit?: number;
}
export class BaseRepository<T> {
	protected table: string;

	constructor(table: string) {
		this.table = table;
	}
	async create(data: Record<string, any>): Promise<T> {
		const keys = Object.keys(data);
		const values = Object.values(data);
		const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
		const query = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
		const result = await pool.query(query, values);
		return result.rows[0];
	}
	async findById(id: number | string): Promise<T | null> {
		const query = `SELECT * FROM ${this.table} WHERE id = $1 LIMIT 1`;
		const result = await pool.query(query, [id]);
		return result.rows[0] || null;
	}
	async findAll(options: QueryOptions = {}): Promise<PaginationResult<T>> {
		const { where = {}, orderBy = 'id', order = 'ASC', page = 1, limit = 10 } = options;
		const whereKeys = Object.keys(where);
		const whereClause = whereKeys.length
			? 'WHERE ' + whereKeys.map((k, i) => `${k} = $${i + 1}`).join(' AND ')
			: '';
		const values = Object.values(where);
		const offset = (page - 1) * limit;
		const query = `SELECT * FROM ${this.table} ${whereClause} ORDER BY ${orderBy} ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
		const result = await pool.query(query, [...values, limit, offset]);
		const countQuery = `SELECT COUNT(*) FROM ${this.table} ${whereClause}`;
		const countResult = await pool.query(countQuery, values);
		const total = parseInt(countResult.rows[0].count, 10);
		const totalPages = Math.ceil(total / limit) || 1;
		return {
			data: result.rows,
			page,
			limit,
			total,
			totalPages,
		};
	}
	async update(id: number | string, data: Record<string, any>): Promise<T | null> {
		const keys = Object.keys(data);
		const values = Object.values(data);
		const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
		const query = `UPDATE ${this.table} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
		const result = await pool.query(query, [...values, id]);
		return result.rows[0] || null;
	}
	async delete(id: number | string): Promise<boolean> {
		const query = `DELETE FROM ${this.table} WHERE id = $1`;
		const result = await pool.query(query, [id]);
		return (result.rowCount ?? 0) > 0;
	}
}