<script lang="ts">
	import { GlassCard } from '$lib';
	import type { Bucket } from '$lib/analytics';
	let { title, buckets }: { title: string; buckets: Bucket[] } = $props();
	const max = $derived(Math.max(1, ...buckets.map((b) => b.count)));
</script>

<GlassCard class="section-card">
	<h2 class="section-title">{title}</h2>
	<div class="rows">
		{#each buckets as b (b.key)}
			<div class="row">
				<span class="row-label">{b.label}</span>
				<div class="track">
					<div class="fill" style:width="{(b.count / max) * 100}%"></div>
				</div>
				<span class="row-count">{b.count}</span>
			</div>
		{:else}
			<p class="muted">No data yet.</p>
		{/each}
	</div>
</GlassCard>

<style>
	.section-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
	}
	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.row {
		display: grid;
		grid-template-columns: 8rem 1fr 2.5rem;
		align-items: center;
		gap: 0.75rem;
	}
	.row-label {
		font-size: 0.8125rem;
		color: var(--color-page-fg-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.track {
		height: 0.5rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		border-radius: 999px;
		background: var(--color-accent);
		opacity: 0.8;
	}
	.row-count {
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.muted {
		color: var(--color-page-fg-muted);
		margin: 0;
	}
</style>
