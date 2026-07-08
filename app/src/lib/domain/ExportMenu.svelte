<script lang="ts">
	import GlassButton from '$lib/glass/GlassButton.svelte';
	import { createExport } from './api';

	let { analysisId }: { analysisId: string } = $props();
	let open = $state(false);
	let busy = $state(false);
	let error: string | null = $state(null);
	let wrapEl: HTMLDivElement | undefined = $state();

	async function onPick(format: 'pdf' | 'pptx' | 'xlsx') {
		open = false;
		busy = true;
		error = null;
		try {
			const res = await createExport(analysisId, format);
			window.open(res.url, '_blank');
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	function onClickOutside(e: MouseEvent) {
		if (open && wrapEl && !wrapEl.contains(e.target as Node)) {
			open = false;
		}
	}
</script>

<svelte:document onclick={onClickOutside} />

<div class="wrap" bind:this={wrapEl}>
	<GlassButton disabled={busy} onclick={() => (open = !open)} title="Export analysis">
		{busy ? '…' : 'Export ▾'}
	</GlassButton>
	{#if open}
		<div class="menu" role="menu">
			<button class="menu-item" role="menuitem" type="button" onclick={() => onPick('pdf')}>PDF</button>
			<button class="menu-item" role="menuitem" type="button" onclick={() => onPick('pptx')}>PowerPoint</button>
			<button class="menu-item" role="menuitem" type="button" onclick={() => onPick('xlsx')}>Excel</button>
		</div>
	{/if}
	{#if error}
		<div class="export-error" role="alert">{error}</div>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
		display: inline-block;
	}
	.menu {
		position: absolute;
		right: 0;
		top: calc(100% + 0.375rem);
		min-width: 10rem;
		padding: 0.375rem;
		border-radius: 0.75rem;
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
		backdrop-filter: blur(20px) saturate(180%);
		-webkit-backdrop-filter: blur(20px) saturate(180%);
		box-shadow: 0 8px 32px rgb(0 0 0 / 0.18);
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.menu-item {
		appearance: none;
		border: 0;
		background: transparent;
		color: var(--color-page-fg);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 500;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4375rem 0.625rem;
		border-radius: 0.5rem;
		cursor: pointer;
		white-space: nowrap;
		transition: background-color 120ms ease;
		text-align: left;
		width: 100%;
	}
	.menu-item:hover {
		background: var(--color-glass-tint-strong);
	}
	.export-error {
		position: absolute;
		right: 0;
		top: calc(100% + 0.375rem);
		min-width: 16rem;
		max-width: 22rem;
		padding: 0.625rem 0.875rem;
		border-radius: 0.75rem;
		background: color-mix(in srgb, var(--color-priority-critical) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-priority-critical) 35%, transparent);
		backdrop-filter: blur(20px) saturate(180%);
		-webkit-backdrop-filter: blur(20px) saturate(180%);
		font-size: 0.8125rem;
		line-height: 1.4;
		color: var(--color-priority-critical);
		z-index: 100;
	}
</style>
