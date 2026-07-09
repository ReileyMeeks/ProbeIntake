<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { intakeStatus } from '$lib/domain/status.svelte';

	let { children } = $props();

	// The login page is unauthenticated and shouldn't show app chrome that
	// implies an in-progress intake (the top strip).
	const showChrome = $derived(page.url.pathname !== '/login');
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

{@render children()}
