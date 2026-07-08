import { describe, it, expect } from 'vitest';
import { computeStreaks, bucketize, formatActivityDate } from './analytics';

describe('computeStreaks', () => {
	it('returns 0/0 for no dates', () => {
		expect(computeStreaks([], '2026-06-01')).toEqual({ current: 0, longest: 0 });
	});
	it('counts a current run ending today', () => {
		expect(computeStreaks(['2026-05-30', '2026-05-31', '2026-06-01'], '2026-06-01')).toEqual({
			current: 3,
			longest: 3
		});
	});
	it('keeps current alive from yesterday', () => {
		expect(computeStreaks(['2026-05-31', '2026-06-01'], '2026-06-02')).toEqual({
			current: 2,
			longest: 2
		});
	});
	it('resets current after a gap but keeps longest', () => {
		const r = computeStreaks(
			['2026-05-20', '2026-05-21', '2026-05-22', '2026-06-01'],
			'2026-06-01'
		);
		expect(r).toEqual({ current: 1, longest: 3 });
	});
});

describe('bucketize', () => {
	it('counts and sorts descending with percentages', () => {
		const out = bucketize(['a', 'b', 'a', 'a'], { a: 'Alpha' });
		expect(out[0]).toEqual({ key: 'a', label: 'Alpha', count: 3, pct: 75 });
		expect(out[1]).toEqual({ key: 'b', label: 'b', count: 1, pct: 25 });
	});
});

describe('formatActivityDate', () => {
	it('formats YYYY-MM-DD as M/D', () => {
		expect(formatActivityDate('2026-06-01')).toBe('6/1');
	});
});
