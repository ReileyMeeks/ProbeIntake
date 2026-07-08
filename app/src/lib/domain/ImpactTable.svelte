<script lang="ts">
	import GlassCard from '$lib/glass/GlassCard.svelte';
	import GlassInput from '$lib/glass/GlassInput.svelte';
	import TierTree from './TierTree.svelte';
	import { buildTierTree, filterRows, allFlags, rankedImpactToLeafNode, type TreeFilters } from './tree';
	import type { RankedImpact } from './types';
	import type { TreeNode } from './tree';

	let {
		rows,
		onSelect,
		analysisId = undefined,
		hasExport2 = false,
		contextMode = false
	}: {
		rows: RankedImpact[];
		onSelect: (n: TreeNode) => void;
		analysisId?: string;
		hasExport2?: boolean;
		contextMode?: boolean;
	} = $props();

	let mode = $state<'flat' | 'tree'>('flat');
	// The full-screen navigator is always the tree; otherwise honor the toggle.
	const effectiveMode = $derived<'flat' | 'tree'>(contextMode ? 'tree' : mode);
	let filter = $state('');
	let deterioratingOnly = $state(false);
	let selectedFlags = $state<string[]>([]);
	let minImpact = $state(0);
	let selectedPath = $state<string | null>(null);

	// Flag options come from ALL rows (not the filtered set) so the pill list
	// stays stable as other filters narrow results.
	const flagOptions = $derived(allFlags(rows));
	const filters = $derived<TreeFilters>({
		search: filter,
		deterioratingOnly,
		flags: selectedFlags,
		minImpact
	});
	const filtered = $derived(filterRows(rows, filters));
	const tree = $derived(buildTierTree(filtered));

	const fmtPct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);
	const fmtUsd = (n: number | null) =>
		n === null
			? '—'
			: n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

	function delta(m25: number | null, m26: number | null): { text: string; dir: 'down' | 'up' | 'flat' } {
		if (m25 === null || m26 === null) return { text: '—', dir: 'flat' };
		const d = (m26 - m25) * 100;
		if (Math.abs(d) < 0.05) return { text: '0.0 pp', dir: 'flat' };
		return { text: `${d > 0 ? '+' : ''}${d.toFixed(1)} pp`, dir: d < 0 ? 'down' : 'up' };
	}

	function pick(node: TreeNode) {
		selectedPath = node.path.join('|');
		onSelect(node);
	}

	function toggleFlag(f: string) {
		selectedFlags = selectedFlags.includes(f)
			? selectedFlags.filter((x) => x !== f)
			: [...selectedFlags, f];
	}
</script>

<GlassCard refraction="none">
	<div class="card-inner">
		<div class="filter-row">
			<GlassInput bind:value={filter} type="search" placeholder="Filter combos…" class="filter-sm" />
			{#if !contextMode}
				<div class="mode-toggle" role="group" aria-label="View mode">
					<button class:active={mode === 'flat'} aria-pressed={mode === 'flat'} onclick={() => (mode = 'flat')}>Flat</button>
					<button class:active={mode === 'tree'} aria-pressed={mode === 'tree'} onclick={() => (mode = 'tree')}>Tree</button>
				</div>
			{/if}
			<label class="switch">
				<input type="checkbox" bind:checked={deterioratingOnly} />
				<span class="switch-track"><span class="switch-thumb"></span></span>
				<span class="switch-label">Deteriorating only</span>
			</label>
			<label class="num">
				Min impact
				<input type="number" min="0" step="1000" bind:value={minImpact} />
			</label>
			{#if flagOptions.length}
				<div class="flags">
					{#each flagOptions as f}
						<button class="flag-pill" class:on={selectedFlags.includes(f)} aria-pressed={selectedFlags.includes(f)} onclick={() => toggleFlag(f)}>{f}</button>
					{/each}
				</div>
			{/if}
		</div>

		{#if effectiveMode === 'tree'}
			<TierTree nodes={tree} onSelect={pick} {selectedPath} {analysisId} {hasExport2} {contextMode} />
		{:else}
			<div class="col-headers">
				<span class="ch ch-combo">Combo</span>
				<span class="ch ch-margin">Margin</span>
				<span class="ch ch-delta">Δ</span>
				<span class="ch ch-rev">2026 Revenue</span>
				<span class="ch ch-impact">Impact</span>
			</div>
			<div class="row-list">
				{#each filtered as r, i}
					{@const d = delta(r.margin_pct_2025, r.margin_pct_2026)}
					{#if i > 0}<div class="row-divider"></div>{/if}
					<button class="impact-row" class:selected={selectedPath === r.combo.join('|')} onclick={() => pick(rankedImpactToLeafNode(r))}>
						<span class="cell cell-combo" title={r.combo.join(' / ')}>{r.combo.join(' / ')}</span>
						<span class="cell cell-margin">
							<span class="m25">{fmtPct(r.margin_pct_2025)}</span>
							<span class="arrow">→</span>
							<span class="m26">{fmtPct(r.margin_pct_2026)}</span>
						</span>
						<span class="cell cell-delta" class:down={d.dir === 'down'} class:up={d.dir === 'up'}>
							{d.text}
						</span>
						<span class="cell cell-rev">{fmtUsd(r.rev_2026)}</span>
						<span class="cell cell-impact" class:deterioration={(r.impact_usd ?? 0) > 0}>{fmtUsd(r.impact_usd === null ? null : -r.impact_usd)}</span>
					</button>
				{/each}
			</div>
			{#if filtered.length === 0}
				<p class="empty-state">No combos match the current filters.</p>
			{/if}
		{/if}
	</div>
</GlassCard>

<style>
	.card-inner {
		padding: 0;
		overflow: hidden;
	}
	.filter-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem 0.625rem;
	}
	:global(.filter-sm) {
		font-size: 0.875rem !important;
		padding: 0.4375rem 0.75rem !important;
		border: 1px solid color-mix(in srgb, var(--color-page-fg) 22%, transparent) !important;
	}
	.mode-toggle { display: inline-flex; border: 1px solid color-mix(in srgb, var(--color-page-fg) 22%, transparent); border-radius: 0.5rem; overflow: hidden; }
	.mode-toggle button { appearance: none; border: 0; background: transparent; color: var(--color-page-fg-muted); font: inherit; font-size: 0.8125rem; padding: 0.3rem 0.7rem; cursor: pointer; }
	.mode-toggle button.active { background: color-mix(in srgb, var(--color-page-fg) 12%, transparent); color: var(--color-page-fg); }
	.num { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8125rem; color: var(--color-page-fg-muted); }
	.num input { width: 6rem; font: inherit; font-size: 0.8125rem; padding: 0.25rem 0.4rem; border-radius: 0.4rem; border: 1px solid color-mix(in srgb, var(--color-page-fg) 22%, transparent); background: transparent; color: inherit; }
	.switch { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.8125rem; color: var(--color-page-fg-muted); cursor: pointer; }
	.switch input { position: absolute; opacity: 0; width: 0; height: 0; }
	.switch-track { position: relative; width: 2rem; height: 1.1rem; border-radius: 999px; background: color-mix(in srgb, var(--color-page-fg) 30%, transparent); transition: background 140ms ease; flex: none; }
	.switch-thumb { position: absolute; top: 50%; left: 0.15rem; transform: translateY(-50%); width: 0.8rem; height: 0.8rem; border-radius: 999px; background: #fff; transition: left 140ms ease; }
	.switch input:checked + .switch-track { background: var(--color-accent); }
	.switch input:checked + .switch-track .switch-thumb { left: calc(100% - 0.95rem); }
	.switch input:focus-visible + .switch-track { outline: 2px solid var(--color-accent); outline-offset: 2px; }
	.flags { display: inline-flex; flex-wrap: wrap; gap: 0.35rem; }
	.flag-pill { appearance: none; border: 1px solid color-mix(in srgb, var(--color-page-fg) 22%, transparent); background: transparent; color: var(--color-page-fg-muted); font: inherit; font-size: 0.75rem; border-radius: 999px; padding: 0.15rem 0.6rem; cursor: pointer; }
	.flag-pill.on { background: color-mix(in srgb, var(--color-accent) 18%, transparent); color: var(--color-accent); border-color: color-mix(in srgb, var(--color-accent) 40%, transparent); }

	.col-headers {
		display: grid;
		grid-template-columns: minmax(240px, 1fr) 8.5rem 5rem 7.5rem 6.5rem;
		column-gap: 0.75rem;
		padding: 0.375rem 1rem;
		border-bottom: 1px solid var(--color-glass-border);
	}
	.ch {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-page-fg-muted);
	}
	.ch-margin, .ch-delta, .ch-rev, .ch-impact {
		text-align: right;
	}

	.row-list {
		display: flex;
		flex-direction: column;
	}
	.row-divider {
		height: 1px;
		background: var(--color-glass-border);
		margin: 0 0.75rem;
	}

	.impact-row {
		appearance: none;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		width: 100%;
		text-align: left;
		display: grid;
		grid-template-columns: minmax(240px, 1fr) 8.5rem 5rem 7.5rem 6.5rem;
		column-gap: 0.75rem;
		padding: 0.625rem 1rem;
		align-items: center;
		transition: background-color 160ms var(--ease-glass);
	}
	.impact-row:hover {
		background: var(--color-glass-tint);
	}
	.impact-row:active {
		background: var(--color-glass-tint-strong);
	}
	.impact-row.selected {
		background: color-mix(in srgb, var(--color-status-open) 10%, transparent);
	}

	.cell-combo {
		font-size: 0.875rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.cell-margin {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		justify-content: flex-end;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}
	.m25 {
		color: var(--color-page-fg-muted);
	}
	.arrow {
		color: var(--color-page-fg-muted);
		font-size: 0.6875rem;
	}
	.m26 {
		font-weight: 500;
	}

	.cell-delta {
		text-align: right;
		font-size: 0.75rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-page-fg-muted);
	}
	.cell-delta.down {
		color: var(--color-priority-critical);
	}
	.cell-delta.up {
		color: var(--color-status-resolved);
	}

	.cell-rev {
		text-align: right;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		color: var(--color-page-fg-muted);
	}

	.cell-impact {
		text-align: right;
		font-size: 0.875rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.cell-impact.deterioration {
		color: var(--color-priority-high);
	}

	.empty-state {
		padding: 1.5rem 1rem;
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-page-fg-muted);
		margin: 0;
	}

	@media (max-width: 720px) {
		.col-headers, .impact-row {
			grid-template-columns: minmax(0, 1fr) 5rem 6rem;
		}
		.ch-margin, .cell-margin, .ch-delta, .cell-delta {
			display: none;
		}
	}
	@media (max-width: 480px) {
		.col-headers, .impact-row {
			grid-template-columns: minmax(0, 1fr) 5.5rem;
		}
		.ch-rev, .cell-rev {
			display: none;
		}
	}
</style>
