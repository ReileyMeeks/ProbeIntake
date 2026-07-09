import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postAnalyze, login } from './client';

describe('api client', () => {
	beforeEach(() => {
		vi.stubGlobal('location', { href: '' } as unknown as Location);
	});

	it('postAnalyze redirects to /login on 401', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 401 }))
		);
		await expect(postAnalyze({ meta: {}, images: [] })).rejects.toThrow();
		expect((globalThis.location as unknown as Location).href).toBe('/login');
	});

	it('login returns false on 401 without redirecting', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 401 }))
		);
		const result = await login('wrong');
		expect(result).toBe(false);
		expect((globalThis.location as unknown as Location).href).toBe('');
	});

	it('login returns true on 200', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 200 }))
		);
		const result = await login('correct');
		expect(result).toBe(true);
	});
});
