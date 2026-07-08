<script lang="ts">
	import { type TreeNode, limitChildren, export2ToNodes } from './tree';
	import { getExport2Subtree } from './api';

	let {
		nodes,
		onSelect,
		selectedPath,
		topN = 5,
		analysisId = undefined,
		hasExport2 = false,
		contextMode = false
	}: {
		nodes: TreeNode[];
		onSelect: (n: TreeNode) => void;
		selectedPath: string | null;
		topN?: number;
		analysisId?: string;
		hasExport2?: boolean;
		/** In the full-screen split, clicking a row selects it as chat context
		 *  (and expands if drillable); the inline "Detail" button is hidden. */
		contextMode?: boolean;
	} = $props();

	let open = $state(new Set<string>());
	let expandedAll = $state(new Set<string>());
	let export2Cache = $state<Record<string, TreeNode[]>>({});
	let export2Loading = $state<Record<string, boolean>>({});

	const fmtPct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`);
	const fmtUsd = (n: number | null) =>
		n === null
			? '—'
			: n.toLocaleString(undefined, {
					style: 'currency',
					currency: 'USD',
					maximumFractionDigits: 0
				});

	function deltaPp(
		a: number | null,
		b: number | null
	): { text: string; dir: 'down' | 'up' | 'flat' } {
		if (a === null || b === null) return { text: '—', dir: 'flat' };
		const d = (b - a) * 100;
		if (Math.abs(d) < 0.05) return { text: '0.0 pp', dir: 'flat' };
		return { text: `${d > 0 ? '+' : ''}${d.toFixed(1)} pp`, dir: d < 0 ? 'down' : 'up' };
	}

	function keyOf(list: TreeNode[]): string {
		return list.length ? list[0].path.slice(0, -1).join('|') : '∅';
	}

	// A node can be drilled if it has child tiers (non-leaf), OR it is a tier-5
	// combo (depth 4) that has Export 2 customer/item detail available.
	function canDrill(node: TreeNode): boolean {
		return !node.isLeaf || (node.depth === 4 && hasExport2 && !!analysisId && !!node.combo_hash);
	}

	async function loadExport2(node: TreeNode) {
		if (!analysisId || !node.combo_hash) return;
		export2Loading = { ...export2Loading, [node.combo_hash]: true };
		try {
			const sub = await getExport2Subtree(analysisId, node.combo_hash);
			export2Cache = { ...export2Cache, [node.combo_hash]: export2ToNodes(sub, node.path) };
		} catch {
			export2Cache = { ...export2Cache, [node.combo_hash]: [] };
		} finally {
			export2Loading = { ...export2Loading, [node.combo_hash]: false };
		}
	}

	function toggle(node: TreeNode) {
		if (!canDrill(node)) return;
		const k = node.path.join('|');
		if (
			node.depth === 4 &&
			node.combo_hash &&
			analysisId &&
			hasExport2 &&
			!(node.combo_hash in export2Cache) &&
			!export2Loading[node.combo_hash] &&
			!open.has(k)
		) {
			loadExport2(node);
		}
		const next = new Set(open);
		next.has(k) ? next.delete(k) : next.add(k);
		open = next;
	}

	function revealAll(list: TreeNode[]) {
		const next = new Set(expandedAll);
		next.add(keyOf(list));
		expandedAll = next;
	}

	// Drillable-row click. In context mode the click also selects the node as the
	// chat's focus; in normal mode it only expands/collapses.
	function rowClick(node: TreeNode) {
		if (contextMode) onSelect(node);
		toggle(node);
	}
</script>

{#snippet rowList(list: TreeNode[])}
	{@const limited = limitChildren(list, expandedAll.has(keyOf(list)) ? list.length : topN)}
	{#each limited.shown as node (node.path.join('|'))}
		{@const d = deltaPp(node.margin_pct_2025, node.margin_pct_2026)}
		<div class="tier-row">
			<div class="combo-cell" style={`padding-left:${node.depth * 1.25 + 0.5}rem`}>
				{#if canDrill(node)}
					<button
						class="disclosure"
						class:selected={node.path.join('|') === selectedPath}
						onclick={() => rowClick(node)}
						aria-expanded={open.has(node.path.join('|'))}
						title={node.path.join(' / ')}
					>
						<span class="twist">{open.has(node.path.join('|')) ? '▾' : '▸'}</span>
						<span class="tier-label">{node.label}</span>
					</button>
				{:else if contextMode}
					<button
						class="disclosure"
						class:selected={node.path.join('|') === selectedPath}
						onclick={() => onSelect(node)}
						title={node.path.join(' / ')}
					>
						<span class="twist">·</span>
						<span class="tier-label">{node.label}</span>
					</button>
				{:else}
					<span
						class="disclosure leaf-static"
						class:selected={node.path.join('|') === selectedPath}
						title={node.path.join(' / ')}
					>
						<span class="twist">·</span>
						<span class="tier-label">{node.label}</span>
					</span>
				{/if}
				{#if !contextMode && !open.has(node.path.join('|'))}
					<!-- frontier node (collapsed or leaf): inline, hover-revealed -->
					<button
						class="detail-btn"
						class:active={node.path.join('|') === selectedPath}
						onclick={() => onSelect(node)}
						title="Provide detail">✨ Detail</button
					>
				{/if}
			</div>
			<span class="cell cell-margin">
				<span class="m25">{fmtPct(node.margin_pct_2025)}</span>
				<span class="arrow">→</span>
				<span class="m26">{fmtPct(node.margin_pct_2026)}</span>
			</span>
			<span class="cell cell-delta" class:down={d.dir === 'down'} class:up={d.dir === 'up'}
				>{d.text}</span
			>
			<span class="cell cell-rev">{fmtUsd(node.rev_2026)}</span>
			<span class="cell cell-impact" class:deterioration={node.impact_usd > 0}
				>{fmtUsd(node.impact_usd)}</span
			>
		</div>

		{#if node.depth === 4}
			<!-- tier-5 combo: optional Export 2 drill-down -->
			{#if canDrill(node) && open.has(node.path.join('|'))}
				{#if export2Loading[node.combo_hash ?? '']}
					<p class="export2-loading" style={`padding-left:${node.depth * 1.25 + 2}rem`}>
						Loading line items…
					</p>
				{:else if (export2Cache[node.combo_hash ?? ''] ?? []).length === 0}
					<p class="export2-empty" style={`padding-left:${node.depth * 1.25 + 2}rem`}>
						No Export 2 line items for this combo.
					</p>
				{:else}
					{@render rowList(export2Cache[node.combo_hash ?? ''] ?? [])}
				{/if}
			{/if}
		{:else if node.isLeaf}
			<!-- depth-7 description leaf (or depth-6 item with no descriptions): no drill -->
		{:else if open.has(node.path.join('|'))}
			{@render rowList(node.children)}
		{/if}
	{/each}
	{#if limited.hiddenCount > 0}
		<div class="show-all" style={`padding-left:${(list[0]?.depth ?? 0) * 1.25 + 1.5}rem`}>
			<button class="show-all-btn" onclick={() => revealAll(list)}
				>+ show all {list.length} ({limited.hiddenCount} more)…</button
			>
		</div>
	{/if}
{/snippet}

<div class="tier-tree">
	<div class="col-headers">
		<span class="ch ch-combo">Combo</span>
		<span class="ch ch-margin">Margin</span>
		<span class="ch ch-delta">Δ</span>
		<span class="ch ch-rev">2026 Revenue</span>
		<span class="ch ch-impact">Impact</span>
	</div>
	{@render rowList(nodes)}
	{#if nodes.length === 0}
		<p class="empty-state">No combos match the current filters.</p>
	{/if}
</div>

<style>
	.col-headers,
	.tier-row {
		display: grid;
		grid-template-columns: minmax(240px, 1fr) 8.5rem 5rem 7.5rem 6.5rem;
		column-gap: 0.75rem;
		align-items: center;
	}
	.col-headers {
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
	.ch-margin,
	.ch-delta,
	.ch-rev,
	.ch-impact {
		text-align: right;
	}
	.tier-row {
		padding: 0.5rem 1rem 0.5rem 0;
	}
	.disclosure {
		appearance: none;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		min-width: 0;
		text-align: left;
		border-radius: 0.4rem;
		padding-top: 0.15rem;
		padding-bottom: 0.15rem;
		padding-right: 0.3rem;
	}
	.disclosure:hover {
		background: var(--color-glass-tint);
	}
	.disclosure.selected {
		background: color-mix(in srgb, var(--color-status-open) 12%, transparent);
	}
	.twist {
		width: 0.9rem;
		color: var(--color-page-fg-muted);
		font-size: 0.75rem;
		flex: none;
	}
	.tier-label {
		font-size: 0.875rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cell-margin {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		justify-content: flex-end;
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}
	.m25,
	.arrow {
		color: var(--color-page-fg-muted);
	}
	.arrow {
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
	.combo-cell {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		min-width: 0;
	}
	.detail-btn {
		flex: none;
		appearance: none;
		border: 1px solid color-mix(in srgb, var(--color-accent) 35%, transparent);
		background: transparent;
		color: var(--color-accent);
		font: inherit;
		font-size: 0.7rem;
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
		border-radius: 0.4rem;
		padding: 0.15rem 0.45rem;
		opacity: 0;
		transition:
			opacity 120ms var(--ease-glass),
			background-color 120ms var(--ease-glass);
	}
	/* Reveal only on row hover / keyboard focus, or when this node is selected —
	   keeps the tree visually quiet and reclaims the vertical space the old
	   full-width action row consumed. */
	.tier-row:hover .detail-btn,
	.detail-btn:focus-visible,
	.detail-btn.active {
		opacity: 1;
	}
	.detail-btn:hover {
		background: var(--color-glass-tint);
	}
	.show-all-btn {
		appearance: none;
		border: 1px dashed color-mix(in srgb, var(--color-accent) 40%, transparent);
		background: transparent;
		color: var(--color-page-fg-muted);
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		border-radius: 0.5rem;
		padding: 0.2rem 0.6rem;
	}
	.show-all-btn:hover {
		background: var(--color-glass-tint);
	}
	.show-all {
		padding-top: 0.1rem;
		padding-bottom: 0.4rem;
	}
	.empty-state {
		padding: 1.5rem 1rem;
		text-align: center;
		font-size: 0.875rem;
		color: var(--color-page-fg-muted);
		margin: 0;
	}
	.leaf-static {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		min-width: 0;
		text-align: left;
		border-radius: 0.4rem;
		padding-top: 0.15rem;
		padding-bottom: 0.15rem;
		padding-right: 0.3rem;
		cursor: default;
	}
	.leaf-static.selected {
		background: color-mix(in srgb, var(--color-status-open) 12%, transparent);
	}
	.export2-loading,
	.export2-empty {
		font-size: 0.75rem;
		color: var(--color-page-fg-muted);
		font-style: italic;
		margin: 0;
		padding-top: 0.2rem;
		padding-bottom: 0.4rem;
	}
	@media (max-width: 720px) {
		.col-headers,
		.tier-row {
			grid-template-columns: minmax(0, 1fr) 5rem 6rem;
		}
		.ch-margin,
		.cell-margin,
		.ch-delta,
		.cell-delta {
			display: none;
		}
	}
	@media (max-width: 480px) {
		.col-headers,
		.tier-row {
			grid-template-columns: minmax(0, 1fr) 5.5rem;
		}
		.ch-rev,
		.cell-rev {
			display: none;
		}
	}
</style>
