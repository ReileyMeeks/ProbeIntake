<script lang="ts">
	import GlassCard from '$lib/glass/GlassCard.svelte';
	import { getFindings, getExport2Subtree, getNodeSummary } from './api';
	import { export2ToNodes, type TreeNode } from './tree';
	import { renderMarkdown } from './markdown';
	import type { Findings } from './types';

	let {
		analysisId,
		selected
	}: {
		analysisId: string;
		selected: TreeNode | null;
	} = $props();

	let loading = $state(false);
	let data: Findings | null = $state(null);
	let error: string | null = $state(null);
	let childRows = $state<TreeNode[]>([]);
	let aiSummary = $state<string | null>(null);
	let aiLoading = $state(false);
	let aiError = $state<string | null>(null);

	async function generateSummary() {
		const node = selected;
		if (!node || aiLoading) return;
		aiLoading = true;
		aiError = null;
		try {
			const res = await getNodeSummary(analysisId, {
				label: node.label,
				path: node.path,
				children: childRows.map((c) => ({
					label: c.label,
					margin_pct_2025: c.margin_pct_2025,
					margin_pct_2026: c.margin_pct_2026,
					impact_usd: c.impact_usd,
					rev_2026: c.rev_2026
				}))
			});
			if (selected === node) aiSummary = res.summary;
		} catch (e) {
			if (selected === node) aiError = e instanceof Error ? e.message : String(e);
		} finally {
			if (selected === node) aiLoading = false;
		}
	}

	const fmtPct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);
	const fmtUsd = (n: number) =>
		n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
	function deltaPp(
		a: number | null,
		b: number | null
	): { text: string; dir: 'down' | 'up' | 'flat' } {
		if (a === null || b === null) return { text: '—', dir: 'flat' };
		const d = (b - a) * 100;
		if (Math.abs(d) < 0.05) return { text: '0.0 pp', dir: 'flat' };
		return { text: `${d > 0 ? '+' : ''}${d.toFixed(1)} pp`, dir: d < 0 ? 'down' : 'up' };
	}

	$effect(() => {
		const node = selected;
		let stale = false;
		data = null;
		error = null;
		childRows = [];
		aiSummary = null;
		aiError = null;
		aiLoading = false;
		if (!node) {
			loading = false;
			return () => {
				stale = true;
			};
		}
		// Children-metrics breakdown: in-tree children if present, else the
		// Export 2 customer rollup for a depth-4 combo.
		if (node.children.length > 0) {
			childRows = node.children;
		} else if (node.combo_hash) {
			getExport2Subtree(analysisId, node.combo_hash)
				.then((st) => {
					if (!stale) childRows = export2ToNodes(st, node.path);
				})
				.catch(() => {
					if (!stale) childRows = [];
				});
		}
		// AI narration only for depth-4 combos.
		if (node.combo_hash) {
			loading = true;
			getFindings(analysisId, node.combo_hash)
				.then((d) => {
					if (!stale) data = d;
				})
				.catch((e) => {
					if (!stale) error = e instanceof Error ? e.message : String(e);
				})
				.finally(() => {
					if (!stale) loading = false;
				});
		} else {
			loading = false;
		}
		return () => {
			stale = true;
		};
	});
</script>

<GlassCard>
	<div class="panel-inner">
		{#if !selected}
			<p class="empty">Select a row to see detail.</p>
		{:else}
			<h3 class="headline">{selected.label}</h3>
			{#if childRows.length > 0}
				<div class="breakdown">
					<div class="bd-head">
						<span>Children</span><span class="num">Margin</span><span class="num">Δ</span><span
							class="num">Impact</span
						>
					</div>
					{#each childRows as c (c.path.join('|'))}
						{@const d = deltaPp(c.margin_pct_2025, c.margin_pct_2026)}
						<div class="bd-row">
							<span class="bd-label" title={c.label}>{c.label}</span>
							<span class="num">{fmtPct(c.margin_pct_2025)}→{fmtPct(c.margin_pct_2026)}</span>
							<span class="num" class:down={d.dir === 'down'} class:up={d.dir === 'up'}
								>{d.text}</span
							>
							<span class="num">{fmtUsd(c.impact_usd)}</span>
						</div>
					{/each}
				</div>
			{:else if !selected.combo_hash}
				<p class="empty">No further breakdown for this row.</p>
			{/if}

			{#if !selected.combo_hash && childRows.length > 0}
				<div class="ai-block">
					{#if aiSummary}
						<span class="tag">AI analysis</span>
						<div class="ai-text">{@html renderMarkdown(aiSummary)}</div>
					{:else if aiLoading}
						<p class="empty">Generating analysis…</p>
					{:else if aiError}
						<p class="err">{aiError}</p>
						<button class="ai-btn" onclick={generateSummary}>Try again</button>
					{:else}
						<button class="ai-btn" onclick={generateSummary}>✨ Generate AI analysis</button>
					{/if}
				</div>
			{/if}

			{#if loading}
				<p class="empty">Loading drivers…</p>
			{:else if error}
				<p class="err">{error}</p>
			{:else if data?.no_drilldown}
				<div class="no-drilldown">
					<p class="no-drilldown-title">No line-item detail</p>
					<p class="no-drilldown-hint">
						Re-run with Export 2 to see cost squeeze, price concession, and mix shift patterns for
						this combo.
					</p>
				</div>
			{:else if data?.narration}
				<span class="tag">AI drivers</span>
				{#if data.narration.source === 'template'}
					<span class="tag">Narrated by template (Claude unavailable)</span>
				{/if}
				{#each data.narration.patterns as p}
					<section class="pattern-section">
						<strong class="pattern-label">{p.pattern.replace('_', ' ')}</strong>
						<p class="pattern-bullet">{p.bullet}</p>
					</section>
				{/each}
				{#if data.narration.caveats && data.narration.caveats.length > 0}
					<details class="caveats">
						<summary class="caveats-label">Caveats ({data.narration.caveats.length})</summary>
						<ul class="caveats-list">
							{#each data.narration.caveats as caveat}
								<li>{caveat}</li>
							{/each}
						</ul>
					</details>
				{/if}
				{#if data.reconciliation?.over_attributed}
					<p class="warn">Detector totals exceed parent impact — over-attribution flag.</p>
				{:else if data.reconciliation && data.reconciliation.residual_usd > 0}
					<p class="note">
						Unexplained residual: ${data.reconciliation.residual_usd.toLocaleString()}
					</p>
				{/if}
			{/if}
		{/if}
	</div>
</GlassCard>

<style>
	.panel-inner {
		padding: 1.25rem;
	}
	.empty {
		color: var(--color-page-fg-muted);
		font-size: 0.875rem;
		margin: 0;
	}
	.headline {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.75rem;
	}
	.tag {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-page-fg-muted);
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
		border-radius: 999px;
		padding: 0.1875rem 0.625rem;
		margin-bottom: 0.75rem;
	}
	.pattern-section {
		margin: 0.75rem 0;
	}
	.pattern-label {
		font-size: 0.8125rem;
		font-weight: 600;
		text-transform: capitalize;
		color: var(--color-page-fg);
	}
	.pattern-bullet {
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--color-page-fg-muted);
		margin: 0.25rem 0 0;
	}
	.warn {
		font-size: 0.8125rem;
		color: var(--color-priority-high);
		margin: 0.75rem 0 0;
	}
	.note {
		font-size: 0.8125rem;
		color: var(--color-page-fg-muted);
		margin: 0.75rem 0 0;
	}
	.err {
		color: var(--color-priority-critical);
		font-size: 0.875rem;
		margin: 0;
	}
	.caveats {
		margin: 1rem 0 0;
		border: 1px solid var(--color-glass-border);
		border-radius: 0.75rem;
		padding: 0;
		overflow: hidden;
	}
	.caveats-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-page-fg-muted);
		padding: 0.5rem 0.875rem;
		cursor: pointer;
		list-style: none;
	}
	.caveats-label::marker {
		content: '';
	}
	.caveats-label::before {
		content: '▸ ';
	}
	.caveats[open] .caveats-label::before {
		content: '▾ ';
	}
	.caveats-list {
		margin: 0;
		padding: 0 0.875rem 0.625rem 1.5rem;
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--color-page-fg-muted);
	}
	.caveats-list li {
		margin-bottom: 0.375rem;
	}
	.no-drilldown {
		text-align: center;
		padding: 1rem 0;
	}
	.no-drilldown-title {
		font-size: 0.875rem;
		font-weight: 500;
		margin: 0 0 0.375rem;
		color: var(--color-page-fg);
	}
	.no-drilldown-hint {
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--color-page-fg-muted);
		margin: 0;
	}
	.breakdown {
		margin: 0.5rem 0 1rem;
	}
	.ai-block {
		margin: 0.25rem 0 0.5rem;
	}
	.ai-text {
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--color-page-fg);
		margin: 0.4rem 0 0;
	}
	.ai-text :global(p) {
		margin: 0.5em 0;
	}
	.ai-text :global(p:first-child) {
		margin-top: 0;
	}
	.ai-text :global(p:last-child) {
		margin-bottom: 0;
	}
	.ai-text :global(strong) {
		font-weight: 600;
		color: var(--color-page-fg);
	}
	.ai-text :global(em) {
		font-style: italic;
	}
	.ai-text :global(ul),
	.ai-text :global(ol) {
		margin: 0.4em 0;
		padding-left: 1.3em;
	}
	.ai-text :global(li) {
		margin: 0.2em 0;
	}
	.ai-text :global(code) {
		background: var(--color-glass-tint);
		border-radius: 0.25rem;
		padding: 0.05rem 0.3rem;
		font-size: 0.78rem;
	}
	.ai-btn {
		appearance: none;
		border: 1px solid color-mix(in srgb, var(--color-accent) 40%, transparent);
		background: transparent;
		color: var(--color-accent);
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		border-radius: 0.5rem;
		padding: 0.25rem 0.65rem;
	}
	.ai-btn:hover {
		background: var(--color-glass-tint);
	}
	.bd-head,
	.bd-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 6.5rem 4rem 5rem;
		gap: 0.5rem;
		align-items: center;
	}
	.bd-head {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-page-fg-muted);
		padding-bottom: 0.25rem;
		border-bottom: 1px solid var(--color-glass-border);
	}
	.bd-row {
		padding: 0.3rem 0;
		font-size: 0.8125rem;
	}
	.bd-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bd-row .num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: var(--color-page-fg-muted);
	}
	.bd-head .num {
		text-align: right;
	}
	.bd-row .num.down {
		color: var(--color-priority-critical);
	}
	.bd-row .num.up {
		color: var(--color-status-resolved);
	}
</style>
