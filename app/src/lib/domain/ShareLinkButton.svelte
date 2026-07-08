<script lang="ts">
	import GlassButton from '$lib/glass/GlassButton.svelte';
	import { mintShareToken, revokeShareToken } from './api';

	let { analysisId }: { analysisId: string } = $props();
	let busy = $state(false);
	let token: string | null = $state(null);
	let toast: string | null = $state(null);

	async function onShare() {
		busy = true;
		try {
			const res = await mintShareToken(analysisId);
			token = res.token;
			const url = `${window.location.origin}/share/${token}`;
			await navigator.clipboard.writeText(url);
			toast = 'Share link copied';
			setTimeout(() => (toast = null), 2500);
		} catch (e) {
			toast = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	async function onRevoke() {
		if (!token) return;
		busy = true;
		try {
			await revokeShareToken(token);
			token = null;
			toast = 'Revoked';
			setTimeout(() => (toast = null), 2500);
		} catch (e) {
			toast = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<GlassButton disabled={busy} onclick={onShare} title="Share analysis">
	{busy ? '…' : 'Share'}
</GlassButton>
{#if token}
	<GlassButton onclick={onRevoke} title="Revoke share link">Revoke</GlassButton>
{/if}
{#if toast}<span class="toast">{toast}</span>{/if}

<style>
	.toast {
		margin-left: 0.5rem;
		font-size: 0.8rem;
		color: #555;
	}
</style>
