/**
 * Generic API client for the MarginTrace FastAPI backend.
 *
 * Configuration: `PUBLIC_API_URL` env var, defaults to `http://localhost:8000`.
 * Use `PUBLIC_` prefix so SvelteKit exposes it to the browser bundle.
 *
 * Error model: every method throws `ApiError` on non-2xx. The error carries
 * the HTTP status + the response body so callers can match on either.
 */

import { env } from '$env/dynamic/public';
import { getAccessToken, invalidateAuth } from '$lib/auth/auth0.svelte';
import type {
	AiConfig,
	AiInstruction,
	AppSource,
	AppUser,
	AssignableUser,
	Attachment,
	CreateAiInstructionRequest,
	CreateAppSourceRequest,
	CreateAppUserRequest,
	CreateMessageRequest,
	CreateTicketRequest,
	DynamicOption,
	HealthResponse,
	InviteUserRequest,
	MondayColumn,
	MyActivityResponse,
	RefineInstructionRequest,
	RefineInstructionResponse,
	SuggestResolutionResponse,
	SummarizeResponse,
	Ticket,
	TicketMessage,
	UpdateAiConfigRequest,
	UpdateAiInstructionRequest,
	UpdateAppSourceRequest,
	UpdateAppUserRequest,
	UpdateTicketRequest,
	UserActivityResponse
} from './types';

const baseURL = (env.PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly bodyText: string,
		public readonly url: string
	) {
		super(`${status} ${url}: ${bodyText.slice(0, 200)}`);
		this.name = 'ApiError';
	}
}

export type FetchOptions = {
	method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	body?: unknown;
	raw?: boolean;
};

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
	const url = `${baseURL}${path}`;

	const token = await getAccessToken();

	const headers: Record<string, string> =
		opts.body instanceof FormData
			? { Accept: 'application/json' }
			: opts.body
				? { 'Content-Type': 'application/json', Accept: 'application/json' }
				: { Accept: 'application/json' };
	if (token) headers.Authorization = `Bearer ${token}`;

	const init: RequestInit = {
		method: opts.method ?? 'GET',
		headers,
		body:
			opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined
	};
	const res = await fetch(url, init);
	if (!res.ok) {
		if (res.status === 401) {
			invalidateAuth();
		}
		const bodyText = await res.text().catch(() => '');
		throw new ApiError(res.status, bodyText, url);
	}
	if (res.status === 204) return undefined as T;
	if (opts.raw) return res as unknown as T;
	return (await res.json()) as T;
}

const call = apiFetch;

// ─── Health ──────────────────────────────────────────────────────────

export const health = {
	get: () => call<HealthResponse>('/health')
};

// ─── Tickets ─────────────────────────────────────────────────────────

export const tickets = {
	list: () => call<Ticket[]>('/tickets'),
	get: (id: string) => call<Ticket>(`/tickets/${id}`),
	create: (body: CreateTicketRequest) => call<Ticket>('/tickets', { method: 'POST', body }),
	update: (id: string, body: UpdateTicketRequest) =>
		call<Ticket>(`/tickets/${id}`, { method: 'PATCH', body }),

	// Messages — nested under a ticket
	listMessages: (id: string) => call<TicketMessage[]>(`/tickets/${id}/messages`),
	postMessage: (id: string, body: CreateMessageRequest) =>
		call<TicketMessage>(`/tickets/${id}/messages`, { method: 'POST', body }),

	// Attachments
	listAttachments: (id: string) => call<Attachment[]>(`/tickets/${id}/attachments`),
	uploadAttachment: async (ticketID: string, file: File): Promise<Attachment> => {
		const url = `${baseURL}/tickets/${ticketID}/attachments`;
		const token = await getAccessToken();
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (token) headers.Authorization = `Bearer ${token}`;
		// Do NOT set Content-Type — browser sets it with the multipart boundary automatically
		const formData = new FormData();
		formData.append('file', file);
		const res = await fetch(url, { method: 'POST', headers, body: formData });
		if (!res.ok) {
			const bodyText = await res.text().catch(() => '');
			throw new ApiError(res.status, bodyText, url);
		}
		return (await res.json()) as Attachment;
	},

	// Assignable users — agents/admins/supervisors only
	assignableUsers: () => call<AssignableUser[]>('/tickets/assignable-users'),

	// On-demand AI actions
	summarize: (id: string) =>
		call<SummarizeResponse>(`/tickets/${id}/ai/summarize`, { method: 'POST' }),
	suggestResolution: (id: string) =>
		call<SuggestResolutionResponse>(`/tickets/${id}/ai/suggest-resolution`, { method: 'POST' })
};

// ─── Attachments ─────────────────────────────────────────────────────

export const attachments = {
	/**
	 * Fetches a short-lived SAS URL for the attachment from the backend
	 * (auth-gated) and returns it for the caller to open directly.
	 *
	 * The SAS URL is a signed Azure Blob URL — the browser opens it without
	 * any custom Authorization header, so images display, PDFs load in the
	 * browser's PDF viewer, and other types trigger a native download dialog.
	 */
	open: async (attachmentID: string): Promise<string> => {
		const { url } = await call<{ url: string }>(`/attachments/${attachmentID}`);
		return url;
	}
};

// ─── App sources ─────────────────────────────────────────────────────

export const appSources = {
	list: () => call<AppSource[]>('/app-sources'),
	get: (id: string) => call<AppSource>(`/app-sources/${id}`),
	create: (body: CreateAppSourceRequest) =>
		call<AppSource>('/app-sources', { method: 'POST', body }),
	update: (id: string, body: UpdateAppSourceRequest) =>
		call<AppSource>(`/app-sources/${id}`, { method: 'PATCH', body }),
	delete: (id: string) => call<void>(`/app-sources/${id}`, { method: 'DELETE' }),

	/**
	 * Fetch the column list for this source's Monday board (or a preview
	 * board passed via ?boardId — useful while editing). Returns
	 * [{id, title, type}] for each column. 400 if no board id is set
	 * and none is passed; 503 if MONDAY_API_TOKEN isn't configured.
	 */
	mondayColumns: (id: string, boardIdOverride?: string) => {
		const qs = boardIdOverride ? `?boardId=${encodeURIComponent(boardIdOverride)}` : '';
		return call<MondayColumn[]>(`/app-sources/${id}/monday/columns${qs}`);
	},

	/**
	 * Fetch dynamic dropdown options for a FormField that opts in via
	 * `dynamicOptions: { source, dependsOn? }`. `context` carries parent
	 * field values used to interpolate the upstream path template (for
	 * cascading dropdowns: customer → site → system). The Vapor endpoint
	 * forwards the user's JWT to RemoteSite so row-level access is
	 * enforced upstream.
	 */
	dynamicOptions: (id: string, source: string, context: Record<string, string> = {}) => {
		const qs = Object.entries(context)
			.filter(([, v]) => v !== '' && v != null)
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
			.join('&');
		const tail = qs ? `?${qs}` : '';
		return call<DynamicOption[]>(
			`/app-sources/${id}/dynamic-options/${encodeURIComponent(source)}${tail}`
		);
	}
};

// ─── AI config + instructions ────────────────────────────────────────

export const ai = {
	config: {
		get: () => call<AiConfig>('/ai/config'),
		update: (body: UpdateAiConfigRequest) => call<AiConfig>('/ai/config', { method: 'PATCH', body })
	},

	instructions: {
		list: (sourceID: string) => call<AiInstruction[]>(`/app-sources/${sourceID}/ai/instructions`),
		create: (sourceID: string, body: CreateAiInstructionRequest) =>
			call<AiInstruction>(`/app-sources/${sourceID}/ai/instructions`, {
				method: 'POST',
				body
			}),
		update: (sourceID: string, instructionID: string, body: UpdateAiInstructionRequest) =>
			call<AiInstruction>(`/app-sources/${sourceID}/ai/instructions/${instructionID}`, {
				method: 'PATCH',
				body
			}),
		delete: (sourceID: string, instructionID: string) =>
			call<void>(`/app-sources/${sourceID}/ai/instructions/${instructionID}`, {
				method: 'DELETE'
			}),
		refine: (body: RefineInstructionRequest) =>
			call<RefineInstructionResponse>('/ai/instructions/refine', { method: 'POST', body })
	}
};

// ─── Current user ────────────────────────────────────────────────────

export const users = {
	/** Push the Auth0 profile name into AppUser. Fire-and-forget from layout. */
	syncName: (name: string) => call<void>('/users/me', { method: 'PATCH', body: { name } })
};

// ─── Admin ───────────────────────────────────────────────────────────

export const admin = {
	users: {
		list: () => call<AppUser[]>('/admin/users'),
		create: (data: CreateAppUserRequest) =>
			call<AppUser>('/admin/users', { method: 'POST', body: data }),
		invite: (data: InviteUserRequest) =>
			call<AppUser>('/admin/users/invite', { method: 'POST', body: data }),
		get: (id: string) => call<AppUser>(`/admin/users/${id}`),
		update: (id: string, data: UpdateAppUserRequest) =>
			call<AppUser>(`/admin/users/${id}`, { method: 'PATCH', body: data }),
		delete: (id: string) => call<void>(`/admin/users/${id}`, { method: 'DELETE' }),

		// Analytics
		userActivity: (days?: number) => {
			const qs = days !== undefined ? `?days=${days}` : '';
			return call<UserActivityResponse>('/api/admin/users/analytics/activity' + qs);
		}
	}
};

// ─── Current-user activity ───────────────────────────────────────────

export const me = {
	activity: (days?: number) => {
		const qs = days !== undefined ? `?days=${days}` : '';
		return call<MyActivityResponse>('/api/me/activity' + qs);
	}
};
