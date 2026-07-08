/**
 * Auth0 PKCE client + reactive user state.
 *
 * Browser-only — the Auth0 SPA SDK references window/sessionStorage/etc.
 * All exports here are guarded so SSR imports don't crash; the actual
 * client is initialized lazily on first browser access.
 *
 * Coexists with the backend's BYPASS_AUTH=1 flag: the dashboard always
 * attempts PKCE if PUBLIC_AUTH0_DOMAIN is configured; the resulting
 * access token is sent on every API call. The FastAPI backend either
 * verifies it (production) or skips auth (dev with BYPASS_AUTH=1).
 */

import { createAuth0Client, type Auth0Client, type User } from '@auth0/auth0-spa-js';
import { env } from '$env/dynamic/public';
import { browser } from '$app/environment';

interface AuthState {
	loading: boolean;
	isAuthenticated: boolean;
	user: User | null;
	error: string | null;
	/** Set after handleRedirectCallback so /auth/callback can navigate to the right page. */
	pendingReturnTo: string | null;
}

const state = $state<AuthState>({
	loading: true,
	isAuthenticated: false,
	user: null,
	error: null,
	pendingReturnTo: null
});

let client: Auth0Client | null = null;

const SSO_KEY = 'template-app_sso_attempted';
let autoLoginInFlight = false;

function configured(): boolean {
	return Boolean(env.PUBLIC_AUTH0_DOMAIN && env.PUBLIC_AUTH0_CLIENT_ID);
}

/** Whether Auth0 env vars are present — use in layouts to gate the auth guard. */
export function isAuthConfigured(): boolean {
	return configured();
}

async function ensureClient(): Promise<Auth0Client | null> {
	if (!browser) return null;
	if (!configured()) return null;
	if (client) return client;
	client = await createAuth0Client({
		domain: env.PUBLIC_AUTH0_DOMAIN!,
		clientId: env.PUBLIC_AUTH0_CLIENT_ID!,
		authorizationParams: {
			redirect_uri: `${window.location.origin}/auth/callback`,
			audience: env.PUBLIC_AUTH0_AUDIENCE || undefined,
			// `offline_access` is required by Auth0 to issue a refresh token
			// alongside the access token. Without it, useRefreshTokens has
			// nothing to refresh from.
			scope: 'openid profile email offline_access'
		},
		// Persist tokens across tabs + reloads. Acceptable trade-off for an
		// internal admin tool — XSS in this dashboard is already game-over.
		cacheLocation: 'localstorage',
		// Use the /oauth/token endpoint with a refresh token instead of
		// the legacy hidden-iframe silent auth flow. The iframe approach is
		// blocked by Safari's ITP (third-party cookie restriction on the
		// auth0.com domain), causing getTokenSilently() to throw login_required
		// even when the user has a valid session. Refresh-token rotation works
		// across all browsers and is Auth0's current recommendation for SPAs.
		useRefreshTokens: true,
		// If the refresh-token call fails (e.g. token revoked), fall back to
		// the iframe flow rather than throwing immediately. On Safari this
		// fallback will also fail, but on Chrome/Firefox it gives one more
		// chance to recover before forcing a re-login.
		useRefreshTokensFallback: true
	});
	return client;
}

/** Initialize on app boot — call once from the root layout's onMount. */
export async function initAuth(): Promise<void> {
	if (!browser) return;
	if (!configured()) {
		// Auth0 not configured (likely local dev with BYPASS_AUTH on the
		// backend). Mark "not authenticated" without an error so the
		// dashboard renders.
		state.loading = false;
		return;
	}
	state.loading = true;
	state.error = null;
	try {
		const c = await ensureClient();
		if (!c) {
			state.loading = false;
			return;
		}
		// Auth0 error response: client not authorized, bad config, etc.
		// Auth0 sends ?error=...&error_description=...&state=... (no code).
		if (location.search.includes('error=') && location.search.includes('state=')) {
			const params = new URLSearchParams(location.search);
			const errorCode = params.get('error');

			// `login_required` from our auto-SSO attempt just means no existing
			// Auth0 session — not a real error. Silently fall through to the
			// landing page so the user can click "Sign in" manually.
			if (errorCode === 'login_required' && sessionStorage.getItem(SSO_KEY)) {
				history.replaceState({}, document.title, location.pathname);
				state.loading = false;
				return;
			}

			state.error =
				params.get('error_description') ?? params.get('error') ?? 'Authentication failed';
			history.replaceState({}, document.title, location.pathname);
			return;
		}

		// Handle the redirect callback if the URL has Auth0's params.
		if (location.search.includes('code=') && location.search.includes('state=')) {
			const result = await c.handleRedirectCallback();
			state.pendingReturnTo =
				(result.appState as { returnTo?: string } | undefined)?.returnTo ?? null;
			// Clean the auth params out of the URL so a refresh doesn't re-run
			// the callback handler.
			history.replaceState({}, document.title, location.pathname);
		}
		const isAuthed = await c.isAuthenticated();
		state.isAuthenticated = isAuthed;
		state.user = isAuthed ? ((await c.getUser()) ?? null) : null;

		if (isAuthed) {
			sessionStorage.removeItem(SSO_KEY);
		}
	} catch (err) {
		state.error = err instanceof Error ? err.message : String(err);
	} finally {
		state.loading = false;
	}
}

/** Start the Auth0 redirect login flow (user-initiated, e.g. clicking "Sign in"). */
export async function login(returnTo?: string): Promise<void> {
	const c = await ensureClient();
	if (!c) return;
	await c.loginWithRedirect({
		appState: { returnTo: returnTo ?? location.pathname }
	});
}

/**
 * Attempt automatic SSO via an existing Auth0 session (e.g. the user is
 * already signed into RemoteSite on the same Auth0 tenant). Uses a
 * top-level redirect — not an iframe — so Safari ITP doesn't interfere.
 *
 * Returns true if a redirect was initiated (page navigates away).
 * Returns false if SSO was already attempted or isn't available, in which
 * case the caller should fall back to showing the landing page.
 */
export async function attemptAutoLogin(returnTo: string): Promise<boolean> {
	if (!browser || !configured()) return false;
	if (autoLoginInFlight) return false;
	if (sessionStorage.getItem(SSO_KEY)) return false;

	const c = await ensureClient();
	if (!c) return false;

	autoLoginInFlight = true;
	sessionStorage.setItem(SSO_KEY, '1');

	try {
		await c.loginWithRedirect({
			appState: { returnTo }
		});
	} catch {
		autoLoginInFlight = false;
		sessionStorage.removeItem(SSO_KEY);
		return false;
	}

	return true;
}

/** Clear local + Auth0 session and return to the dashboard root. */
export async function logout(): Promise<void> {
	const c = await ensureClient();
	if (!c) return;
	await c.logout({
		logoutParams: { returnTo: window.location.origin }
	});
}

/**
 * Get the current access token for outbound API calls. Returns null when
 * Auth0 isn't configured (dev with BYPASS_AUTH=1 on the backend) or when
 * the SDK can't produce a token even after a refresh attempt.
 *
 * Token-refresh failures are logged to the console because silently
 * sending an unauthenticated request will result in a 401 from the
 * backend that's hard to diagnose otherwise. The caller still gets null
 * (request proceeds without Authorization) so dev with BYPASS_AUTH keeps
 * working.
 */
export async function getAccessToken(): Promise<string | null> {
	if (!browser) return null;
	if (!configured()) return null;
	const c = await ensureClient();
	if (!c) return null;
	try {
		return await c.getTokenSilently();
	} catch (err) {
		const code = (err as { error?: string })?.error;
		// `login_required` is the expected failure when there's truly no session;
		// `consent_required` / `interaction_required` mean the SDK needs a
		// redirect to recover. Either way, the API call below will get a 401.
		console.warn('[auth] getTokenSilently failed', { code, err });
		return null;
	}
}

/**
 * Called by the API client when the backend returns 401. Marks the local
 * session as invalid so the layout's auth guard redirects to login.
 * Does not call Auth0 logout — that would require a round-trip; the layout
 * redirect is enough to force the user back through the login flow.
 */
export function invalidateAuth(): void {
	state.isAuthenticated = false;
	state.user = null;
}

/** Reactive snapshot of auth state — components import this to render
 *  login/logout buttons + user-aware UI. */
export const auth = {
	get state() {
		return state;
	}
};
