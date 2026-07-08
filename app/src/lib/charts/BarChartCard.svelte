<script lang="ts">
	import { GlassCard, GlassButton, formatActivityDate } from '$lib';
	import type { DayCount } from '$lib/analytics';

	let {
		title,
		data,
		days = $bindable(30),
		ranges = [7, 14, 30],
		onRange,
		ariaLabel
	}: {
		title: string;
		data: DayCount[];
		days?: number;
		ranges?: number[];
		onRange?: (d: number) => void;
		ariaLabel?: string;
	} = $props();

	const max = $derived(Math.max(1, ...data.map((d) => d.count)));

	function setRange(d: number) {
		days = d;
		onRange?.(d);
	}
</script>

<GlassCard class="section-card">
	<div class="section-header">
		<h2 class="section-title">{title}</h2>
		<div class="range-toggle">
			{#each ranges as r (r)}
				<GlassButton
					size="sm"
					variant={days === r ? 'prominent' : 'default'}
					onclick={() => setRange(r)}
				>
					{r}d
				</GlassButton>
			{/each}
		</div>
	</div>
	<div class="chart" role="img" aria-label={ariaLabel ?? title}>
		{#each data as day (day.date)}
			<div class="col" title="{formatActivityDate(day.date)}: {day.count}">
				<div class="bar" style:height="{day.count ? (day.count / max) * 100 : 0}%"></div>
				{#if days <= 14}
					<span class="bar-label">{formatActivityDate(day.date)}</span>
				{/if}
			</div>
		{/each}
	</div>
</GlassCard>

<style>
	:global(.section-card) {
		padding: 1.25rem 1.5rem;
	}
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	.section-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		letter-spacing: -0.01em;
	}
	.range-toggle {
		display: flex;
		gap: 0.25rem;
	}
	.chart {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 160px;
		padding-top: 0.5rem;
	}
	.col {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		height: 100%;
		min-width: 0;
	}
	.bar {
		width: 100%;
		min-height: 2px;
		border-radius: 3px 3px 0 0;
		background: var(--color-accent);
		opacity: 0.75;
		transition: height 300ms var(--ease-glass);
	}
	.col:hover .bar {
		opacity: 1;
	}
	.bar-label {
		font-size: 0.625rem;
		color: var(--color-page-fg-muted);
		margin-top: 0.25rem;
		white-space: nowrap;
	}
	@media (max-width: 480px) {
		.chart {
			height: 120px;
		}
	}
</style>
