import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postAnalyze, login, checkSession, extractForm } from './client';

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

	it('checkSession returns true on 200 without redirecting', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 200 }))
		);
		expect(await checkSession()).toBe(true);
		expect((globalThis.location as unknown as Location).href).toBe('');
	});

	it('checkSession returns false on 401 without redirecting', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 401 }))
		);
		expect(await checkSession()).toBe(false);
		expect((globalThis.location as unknown as Location).href).toBe('');
	});

	it('extractForm returns the parsed fields object on success', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify({ model: 'C1-6-D', sn: '250840YP6' }), { status: 200 })
			)
		);
		const result = await extractForm([{ mediaType: 'image/jpeg', base64: 'QUJD' }]);
		expect(result).toEqual({ model: 'C1-6-D', sn: '250840YP6' });
	});

	it('extractForm returns {} on a non-ok response, without throwing', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 502 }))
		);
		expect(await extractForm([])).toEqual({});
	});

	it('extractForm returns {} on a network failure, without throwing', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);
		expect(await extractForm([])).toEqual({});
	});

	it('extractForm returns {} on session expiry (401) rather than throwing', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 401 }))
		);
		expect(await extractForm([])).toEqual({});
		expect((globalThis.location as unknown as Location).href).toBe('/login');
	});
});
