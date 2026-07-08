import { describe, it, expect } from 'vitest';
import { fmtUsd, fmtDelta } from './format';

describe('compare formatting', () => {
	it('formats usd and missing', () => {
		expect(fmtUsd(null)).toBe('—');
		expect(fmtUsd(-1500)).toBe('-$1,500');
	});
	it('formats signed delta', () => {
		expect(fmtDelta(null)).toBe('—');
		expect(fmtDelta(-500)).toBe('-$500');
		expect(fmtDelta(500)).toBe('+$500');
	});
});
