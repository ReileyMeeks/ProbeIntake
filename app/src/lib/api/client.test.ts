import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postAnalyze } from './client';

describe('api client', () => {
	beforeEach(() => {
		vi.stubGlobal('location', { href: '' } as unknown as Location);
	});

	it('redirects to /login on 401', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 401 }))
		);
		await expect(postAnalyze({ meta: {}, images: [] })).rejects.toThrow();
		expect((globalThis.location as unknown as Location).href).toBe('/login');
	});
});
