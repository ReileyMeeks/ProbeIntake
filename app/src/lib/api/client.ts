/**
 * Fetch-based client for the Probe Intake proxy's `/api/*` endpoints.
 *
 * The proxy (Vapor) serves the built SPA and the API from the same origin,
 * so `base` is empty locally and in the deployed image. Session auth is a
 * cookie set by `/api/login`; every request must send `credentials: 'include'`
 * so the cookie flows. A `401` response means the session is missing/expired —
 * redirect to `/login` and throw so the caller doesn't try to use the result.
 */

import type { AnalyzeResult, CapturedImage, ProbeMeta } from '$lib/domain/probe';

const base = '';

async function post(path: string, body: unknown, { redirectOn401 = true } = {}): Promise<Response> {
	const res = await fetch(`${base}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
		credentials: 'include'
	});
	if (res.status === 401 && redirectOn401) {
		location.href = '/login';
		throw new Error('unauthorized');
	}
	return res;
}

export async function login(password: string): Promise<boolean> {
	const res = await post('/api/login', { password }, { redirectOn401: false });
	return res.ok;
}

/**
 * Used by the root layout's client-side guard to check for a valid session
 * before rendering the app. Deliberately does not auto-redirect on 401 —
 * the caller decides how/when to navigate to `/login` (and needs to gate
 * rendering on the result rather than have this throw).
 */
export async function checkSession(): Promise<boolean> {
	const res = await fetch(`${base}/api/session`, { credentials: 'include' });
	return res.ok;
}

export async function postAnalyze(req: {
	meta: ProbeMeta;
	images: Pick<CapturedImage, 'mediaType' | 'base64' | 'isForm'>[];
}): Promise<AnalyzeResult> {
	const res = await post('/api/analyze', req);
	if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
	return res.json();
}

export async function postEmail(req: {
	to: string;
	subject: string;
	summary: string;
	pdfBase64?: string;
}): Promise<void> {
	const res = await post('/api/email', req);
	if (!res.ok) throw new Error(`email failed: ${res.status}`);
}
