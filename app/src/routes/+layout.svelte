<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { intakeStatus } from '$lib/domain/status.svelte';
	import { checkSession } from '$lib/api/client';

	let { children } = $props();

	// The login page is unauthenticated and shouldn't show app chrome that
	// implies an in-progress intake (the top strip), and must never guard
	// itself (that would loop: no session -> redirect to /login -> /login
	// checks session -> redirect to /login -> ...).
	const isLoginRoute = $derived(page.url.pathname === '/login');
	const showChrome = $derived(!isLoginRoute);

	// Client-side session guard. The backend gate (AuthGate on /api/*) only
	// blocks API calls with a 401 — it does nothing to stop the static SPA
	// shell itself from rendering, so without this an unauthenticated visitor
	// could open the intake screen directly. `authState` starts 'checking' so
	// `children` stays ungated (nothing renders) until `checkSession()`
	// resolves, which avoids flashing the app UI before the redirect lands.
	// This only ever runs client-side: `+layout.ts` sets `ssr = false`, and
	// `onMount` itself never fires during SSR anyway.
	let authState = $state<'checking' | 'authed'>('checking');

	onMount(() => {
		if (isLoginRoute) return;
		checkSession().then((ok) => {
			if (ok) {
				authState = 'authed';
			} else {
				location.href = '/login';
			}
		});
	});
</script>

<svelte:head>
	<title>Avante Probe Intake</title>
</svelte:head>

{#if showChrome}
	<header class="strip">
		<div class="strip-brand">
			<span class="strip-logo">
				<img src="/logo.png" alt="Avante Health Solutions" />
			</span>
			<span class="strip-word">
				<span class="strip-avante">avante</span>
				<span class="strip-sep" aria-hidden="true"></span>
				<span class="strip-app">probe intake</span>
			</span>
		</div>
		<div class="strip-right">
			<span class="status-chip {intakeStatus.status}">
				<span class="status-dot" aria-hidden="true"
					>{intakeStatus.status === 'analyzing' ? '◐' : '●'}</span
				>
				{intakeStatus.status === 'analyzing' ? 'analyzing…' : 'ready'}
			</span>
			{#if intakeStatus.woNumber}
				<span class="strip-wo">WO# {intakeStatus.woNumber}</span>
			{/if}
		</div>
	</header>
{/if}

{#if isLoginRoute || authState === 'authed'}
	{@render children()}
{/if}
