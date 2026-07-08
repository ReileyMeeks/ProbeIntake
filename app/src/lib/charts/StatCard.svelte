<script lang="ts">
	import { GlassCard } from '$lib';
	let { value, label }: { value: string | number; label: string } = $props();
</script>

<GlassCard class="stat-card">
	<span class="stat-value">{value}</span>
	<span class="stat-label">{label}</span>
</GlassCard>

<style>
	:global(.stat-card) {
		padding: 1.25rem 1rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}
	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		letter-spacing: -0.03em;
	}
	.stat-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-page-fg-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	@media (max-width: 480px) {
		.stat-value {
			font-size: 1.5rem;
		}
	}
</style>
