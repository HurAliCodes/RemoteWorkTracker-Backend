import { periodDatesUtc } from './dashboard.service';

describe('periodDatesUtc', () => {
	it('returns inclusive UTC window for days=1 ending today', () => {
		const { startDate, endDate } = periodDatesUtc(1);
		expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(startDate).toBe(endDate);
	});

	it('spans N calendar days in UTC', () => {
		const { startDate, endDate } = periodDatesUtc(7);
		const start = new Date(`${startDate}T12:00:00.000Z`).getTime();
		const end = new Date(`${endDate}T12:00:00.000Z`).getTime();
		const diffDays = Math.round((end - start) / (24 * 60 * 60 * 1000));
		expect(diffDays).toBe(6);
	});
});
