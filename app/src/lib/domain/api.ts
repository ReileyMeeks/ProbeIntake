import { env } from '$env/dynamic/public';
import type {
	AnalysisSummary,
	RankedImpact,
	Findings,
	ColumnMapping,
	Export2ColumnMapping,
	Thresholds,
	Me,
	AdminUser,
	InviteUserInput,
	UserRole,
	Comparison,
	Export2Subtree
} from './types';

/**
 * This module targets an unrelated donor backend (MarginTrace FastAPI, see
 * `PUBLIC_API_URL`) inherited from the template this SPA was scaffolded
 * from — NOT the Probe Intake proxy. It's unreachable from any real route
 * except transitively via `$lib/domain/me.svelte.ts`'s disabled-by-default
 * auth skeleton (see app/CLAUDE.md). Kept self-contained (own fetch helper)
 * rather than sharing `$lib/api/client`, which is now the real Probe Intake
 * client for `/api/login|analyze|email`. Slated for removal once the
 * donor auth skeleton is cleaned up.
 */
class DonorApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly bodyText: string,
		public readonly url: string
	) {
		super(`${status} ${url}: ${bodyText.slice(0, 200)}`);
		this.name = 'DonorApiError';
	}
}

type DonorFetchOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown };

async function apiFetch<T>(path: string, opts: DonorFetchOptions = {}): Promise<T> {
	const baseURL = (env.PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
	const url = `${baseURL}${path}`;
	const headers: Record<string, string> =
		opts.body instanceof FormData
			? { Accept: 'application/json' }
			: opts.body
				? { 'Content-Type': 'application/json', Accept: 'application/json' }
				: { Accept: 'application/json' };
	const res = await fetch(url, {
		method: opts.method ?? 'GET',
		headers,
		body:
			opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined
	});
	if (!res.ok) {
		const bodyText = await res.text().catch(() => '');
		throw new DonorApiError(res.status, bodyText, url);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

export async function listAnalyses(): Promise<AnalysisSummary[]> {
	return apiFetch('/api/analyses');
}

export async function getAnalysis(id: string): Promise<AnalysisSummary> {
	return apiFetch(`/api/analyses/${id}`);
}

export async function getRankedImpacts(id: string): Promise<RankedImpact[]> {
	return apiFetch(`/api/analyses/${id}/ranked-impacts`);
}

export async function getFindings(analysisId: string, comboHash: string): Promise<Findings> {
	return apiFetch(`/api/findings/${analysisId}/${comboHash}`);
}

export type NodeSummaryChild = {
	label: string;
	margin_pct_2025: number | null;
	margin_pct_2026: number | null;
	impact_usd: number | null;
	rev_2026: number | null;
};

export async function getNodeSummary(
	analysisId: string,
	body: { label: string; path: string[]; children: NodeSummaryChild[] }
): Promise<{ summary: string }> {
	return apiFetch(`/api/analyses/${analysisId}/node-summary`, { method: 'POST', body });
}

export async function createAnalysis(opts: {
	name: string;
	thresholds: Thresholds;
	columnMapping: ColumnMapping;
	export1: File;
	export2?: File;
	export2ColumnMapping?: Export2ColumnMapping;
}): Promise<{ id: string; name: string; row_count: number; warnings: string[] }> {
	const fd = new FormData();
	fd.append('name', opts.name);
	fd.append('column_mapping', JSON.stringify(opts.columnMapping));
	fd.append('thresholds', JSON.stringify(opts.thresholds));
	fd.append('export1', opts.export1);
	if (opts.export2 && opts.export2ColumnMapping) {
		fd.append('export2', opts.export2);
		fd.append('export2_column_mapping', JSON.stringify(opts.export2ColumnMapping));
	}
	return apiFetch('/api/analyses', { method: 'POST', body: fd });
}

export async function mintShareToken(analysisId: string): Promise<{ token: string }> {
	return apiFetch(`/api/share-tokens?analysis_id=${analysisId}`, { method: 'POST' });
}

export async function revokeShareToken(token: string): Promise<void> {
	await apiFetch(`/api/share-tokens/${token}`, { method: 'DELETE' });
}

export async function createExport(
	analysisId: string,
	format: 'pdf' | 'pptx' | 'xlsx'
): Promise<{ id: number; format: string; url: string; blob_path: string }> {
	return apiFetch(`/api/exports/${analysisId}?format=${format}`, { method: 'POST' });
}

export async function readShare(token: string) {
	const base = (env.PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
	const r = await fetch(`${base}/share/${token}`);
	if (!r.ok) throw new Error(`share read failed: ${r.status}`);
	return r.json();
}

export async function getMe(): Promise<Me> {
	return apiFetch('/api/me');
}

export async function listUsers(): Promise<AdminUser[]> {
	return apiFetch('/api/admin/users');
}

export async function inviteUser(body: InviteUserInput): Promise<AdminUser> {
	return apiFetch('/api/admin/users/invite', { method: 'POST', body });
}

export async function updateUser(
	id: string,
	body: { name?: string; role?: UserRole }
): Promise<AdminUser> {
	return apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body });
}

export async function deleteUser(id: string): Promise<void> {
	await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
}

export async function deleteAnalysis(id: string): Promise<void> {
	await apiFetch(`/api/analyses/${id}`, { method: 'DELETE' });
}

export async function compareAnalyses(ids: string[]): Promise<Comparison> {
	const qs = ids.map((id) => `ids=${encodeURIComponent(id)}`).join('&');
	return apiFetch(`/api/compare?${qs}`);
}

export function compareExportUrl(ids: string[], format: 'pdf' | 'pptx' | 'xlsx'): string {
	const qs = ids.map((id) => `ids=${encodeURIComponent(id)}`).join('&');
	return `/api/compare/export?format=${format}&${qs}`;
}

export async function getExport2Subtree(
	analysisId: string,
	comboHash: string
): Promise<Export2Subtree> {
	return apiFetch(`/api/analyses/${analysisId}/export2-subtree/${comboHash}`);
}
