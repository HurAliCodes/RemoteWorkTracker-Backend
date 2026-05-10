export interface PaginationParams {
	page?: number;
	limit?: number;
}
export interface PaginationResult<T> {
	data: T[];
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}
export function paginate<T>(data: T[], page = 1, limit = 10): PaginationResult<T> {
	const total = data.length;
	const totalPages = Math.ceil(total / limit) || 1;
	const start = (page - 1) * limit;
	const end = start + limit;
	return {
		data: data.slice(start, end),
		page,
		limit,
		total,
		totalPages,
	};
}
