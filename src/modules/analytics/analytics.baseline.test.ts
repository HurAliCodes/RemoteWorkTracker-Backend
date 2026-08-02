import { baselineHistoryFromAiWeeklyPayload } from './analytics.service';

describe('baselineHistoryFromAiWeeklyPayload', () => {
	it('uses real working/idle hours from nested report (no fabricated 8/1 defaults)', () => {
		const points = baselineHistoryFromAiWeeklyPayload({
			history: [
				{
					created_at: '2026-07-01T12:00:00',
					productivity_score: 70,
					report: { working_hours: 6.5, idle_hours: 2.25, productivity_score: 70 },
				},
			],
		});
		expect(points).toEqual([
			{
				date: '2026-07-01',
				productivityScore: 70,
				workingHours: 6.5,
				idleHours: 2.25,
			},
		]);
	});

	it('defaults missing hours to 0 rather than fabricated baselines', () => {
		const points = baselineHistoryFromAiWeeklyPayload({
			history: [{ created_at: '2026-07-02T00:00:00', productivity_score: 55 }],
		});
		expect(points[0].workingHours).toBe(0);
		expect(points[0].idleHours).toBe(0);
	});
});
