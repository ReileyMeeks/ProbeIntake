import { describe, it, expect } from 'vitest';
import { computeDownscaledSize, downscaleToJpeg, MAX_DIMENSION } from './downscale';

describe('computeDownscaledSize', () => {
	it('caps a large landscape image at MAX_DIMENSION on the long edge', () => {
		const { width, height } = computeDownscaledSize(4000, 3000);
		expect(width).toBe(MAX_DIMENSION);
		expect(height).toBeLessThanOrEqual(MAX_DIMENSION);
		expect(height).toBe(1200); // aspect ratio preserved: 3000/4000 * 1600
	});

	it('caps a large portrait image at MAX_DIMENSION on the long edge', () => {
		const { width, height } = computeDownscaledSize(3000, 4000);
		expect(height).toBe(MAX_DIMENSION);
		expect(width).toBeLessThanOrEqual(MAX_DIMENSION);
		expect(width).toBe(1200);
	});

	it('leaves an already-small image untouched', () => {
		expect(computeDownscaledSize(800, 600)).toEqual({ width: 800, height: 600 });
	});

	it('never returns a zero or negative dimension for degenerate input', () => {
		const { width, height } = computeDownscaledSize(0, 0);
		expect(width).toBeGreaterThan(0);
		expect(height).toBeGreaterThan(0);
	});
});

describe('downscaleToJpeg', () => {
	// jsdom has no real <canvas> 2D implementation (getContext('2d') and
	// toDataURL both return null), so this can only exercise the graceful
	// fallback path here — real-browser canvas behavior is out of reach in
	// this test environment. See capture.test.ts for the same note applied
	// to the CapturePanel upload flow.
	it('falls back to the provided data URL when canvas support is unavailable', () => {
		const fallback = 'data:image/jpeg;base64,AQIDBAU=';
		const result = downscaleToJpeg(null, 4000, 3000, fallback);
		expect(result.mediaType).toBe('image/jpeg');
		expect(result.dataUrl).toBe(fallback);
		expect(result.base64).toBe('AQIDBAU=');
	});

	it('returns an empty base64 (not a throw) when the fallback has no base64 payload', () => {
		const result = downscaleToJpeg(null, 100, 100, 'data:image/jpeg,not-base64');
		expect(result.base64).toBe('');
	});
});
