<script lang="ts">
	import GlassCard from '$lib/glass/GlassCard.svelte';
	import { DEFAULT_THRESHOLDS, type Thresholds } from './types';

	let {
		thresholds = $bindable<Thresholds>({ ...DEFAULT_THRESHOLDS })
	}: { thresholds?: Thresholds } = $props();

	let showTooltip = $state(false);
</script>

<GlassCard flat>
	<div class="card-pad">
		<div class="title-row">
			<h3 class="section-title">Detection thresholds</h3>
			<span
				class="info-icon"
				role="button"
				tabindex="0"
				aria-label="What are detection thresholds?"
				onmouseenter={() => {
					showTooltip = true;
				}}
				onmouseleave={() => {
					showTooltip = false;
				}}
				onfocus={() => {
					showTooltip = true;
				}}
				onblur={() => {
					showTooltip = false;
				}}
			>
				ⓘ
				{#if showTooltip}
					<div class="tooltip" role="tooltip">
						Controls detection sensitivity. Price-flat band sets the tolerance for "no meaningful
						price change." Cost-spike, price-drop, and mix-drop set the minimum movement to flag
						each pattern. Lower values catch more; higher values reduce noise.
					</div>
				{/if}
			</span>
		</div>
		<div class="grid">
			<label class="field">
				<span class="field-label">Price-flat band %</span>
				<input
					class="glass-field"
					type="number"
					step="0.1"
					bind:value={thresholds.price_flat_band_pct}
				/>
			</label>
			<label class="field">
				<span class="field-label">Cost-spike % (min)</span>
				<input
					class="glass-field"
					type="number"
					step="0.1"
					bind:value={thresholds.cost_spike_pct}
				/>
			</label>
			<label class="field">
				<span class="field-label">Price-drop % (min)</span>
				<input
					class="glass-field"
					type="number"
					step="0.1"
					bind:value={thresholds.price_drop_pct}
				/>
			</label>
			<label class="field">
				<span class="field-label">Mix-drop pp (min)</span>
				<input class="glass-field" type="number" step="0.1" bind:value={thresholds.mix_drop_pp} />
			</label>
		</div>
	</div>
</GlassCard>

<style>
	.card-pad {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.section-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
	}
	.info-icon {
		position: relative;
		color: var(--color-page-fg-muted);
		font-size: 0.9375rem;
		cursor: help;
		line-height: 1;
		user-select: none;
	}
	.tooltip {
		position: absolute;
		left: 50%;
		top: calc(100% + 0.5rem);
		transform: translateX(-50%);
		width: 280px;
		padding: 0.75rem 1rem;
		background: var(--color-card-opaque);
		backdrop-filter: blur(16px) saturate(180%);
		-webkit-backdrop-filter: blur(16px) saturate(180%);
		border: 1px solid var(--color-glass-border-bright);
		border-radius: 0.75rem;
		box-shadow: var(--shadow-glass-md);
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--color-page-fg-muted);
		z-index: 30;
		pointer-events: none;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.75rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.field-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-page-fg-muted);
	}
	.glass-field {
		display: block;
		width: 100%;
		padding: 0.625rem 0.875rem;
		font: inherit;
		color: var(--color-page-fg);
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
		border-radius: 999px;
		backdrop-filter: blur(12px) saturate(160%);
		-webkit-backdrop-filter: blur(12px) saturate(160%);
		transition: border-color 160ms var(--ease-glass);
	}
	.glass-field::placeholder {
		color: var(--color-page-fg-muted);
	}
	.glass-field:hover {
		border-color: var(--color-glass-border-bright);
	}

	@media (max-width: 480px) {
		.card-pad {
			padding: 1rem;
		}
		.grid {
			grid-template-columns: 1fr 1fr;
		}
		.tooltip {
			left: 0;
			transform: none;
		}
	}
</style>
