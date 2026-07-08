import type { RankedImpact, Export2Subtree } from './types';

export type TreeNode = {
	/** Value of the dimension at this depth (e.g. a business name). */
	label: string;
	/** 0 = business … 4 = new_or_other. */
	depth: number;
	/** combo prefix from root to this node, e.g. ['Industrial','Direct']. */
	path: string[];
	rev_2025: number;
	rev_2026: number;
	cost_2025: number;
	cost_2026: number;
	margin_pct_2025: number | null;
	margin_pct_2026: number | null;
	/** Sum of non-null leaf impacts beneath this node. */
	impact_usd: number;
	/** Union of flags across leaves beneath this node. */
	flags: string[];
	/** True for a node with no expandable children (a depth-4 combo, a depth-7
	 *  description, or a depth-6 item that has no descriptions). */
	isLeaf: boolean;
	/** Present only on leaves: the original row's combo_hash. */
	combo_hash: string | null;
	/** The original leaf row (leaves only) — passed to "Provide detail". */
	leaf: RankedImpact | null;
	/** Direct children, one tier deeper, sorted by |impact| desc. */
	children: TreeNode[];
};

const MAX_DEPTH = 4; // 5 levels, 0-indexed

function margin(rev: number, cost: number): number | null {
	return rev ? 1 - cost / rev : null;
}

function buildLevel(rows: RankedImpact[], depth: number, parentPath: string[]): TreeNode[] {
	const groups = new Map<string, RankedImpact[]>();
	for (const r of rows) {
		const key = r.combo[depth];
		const bucket = groups.get(key);
		if (bucket) bucket.push(r);
		else groups.set(key, [r]);
	}

	const nodes: TreeNode[] = [];
	for (const [label, groupRows] of groups) {
		const path = [...parentPath, label];
		let rev25 = 0,
			rev26 = 0,
			cost25 = 0,
			cost26 = 0,
			impact = 0;
		const flagSet = new Set<string>();
		for (const r of groupRows) {
			rev25 += r.rev_2025;
			rev26 += r.rev_2026;
			cost25 += r.cost_2025;
			cost26 += r.cost_2026;
			if (r.impact_usd !== null) impact += r.impact_usd;
			for (const f of r.flags) flagSet.add(f);
		}
		const isLeaf = depth === MAX_DEPTH;
		const leafRow = isLeaf ? groupRows[0] : null;
		nodes.push({
			label,
			depth,
			path,
			rev_2025: rev25,
			rev_2026: rev26,
			cost_2025: cost25,
			cost_2026: cost26,
			margin_pct_2025: margin(rev25, cost25),
			margin_pct_2026: margin(rev26, cost26),
			impact_usd: impact,
			flags: [...flagSet],
			isLeaf,
			combo_hash: leafRow ? leafRow.combo_hash : null,
			leaf: leafRow,
			children: isLeaf ? [] : buildLevel(groupRows, depth + 1, path)
		});
	}

	nodes.sort((a, b) => Math.abs(b.impact_usd) - Math.abs(a.impact_usd));
	return nodes;
}

/** Build the full tier tree (depth 0..4) from flat ranked-impact rows. */
export function buildTierTree(rows: RankedImpact[]): TreeNode[] {
	return buildLevel(rows, 0, []);
}

export type TreeFilters = {
	search: string;
	deterioratingOnly: boolean;
	flags: string[];
	minImpact: number;
};

/** Apply leaf-level filters. Used before building the tree so parents are
 *  retained exactly when a descendant survives. */
export function filterRows(rows: RankedImpact[], f: TreeFilters): RankedImpact[] {
	const search = f.search.trim().toLowerCase();
	return rows.filter((r) => {
		if (search && !r.combo.join(' / ').toLowerCase().includes(search)) return false;
		if (f.deterioratingOnly && !((r.impact_usd ?? 0) > 0)) return false;
		if (f.minImpact > 0 && Math.abs(r.impact_usd ?? 0) < f.minImpact) return false;
		if (f.flags.length && !f.flags.some((flag) => r.flags.includes(flag))) return false;
		return true;
	});
}

/** Split a node list into the visible top-N and the count of hidden siblings. */
export function limitChildren(
	nodes: TreeNode[],
	n: number
): { shown: TreeNode[]; hiddenCount: number } {
	if (nodes.length <= n) return { shown: nodes.slice(), hiddenCount: 0 };
	return { shown: nodes.slice(0, n), hiddenCount: nodes.length - n };
}

/** Convenience: collect the union of all flags present in the rows. */
export function allFlags(rows: RankedImpact[]): string[] {
	const set = new Set<string>();
	for (const r of rows) for (const flag of r.flags) set.add(flag);
	return [...set].sort();
}

/** Map an Export 2 subtree (customers→items→descriptions) into TreeNodes
 *  parented at a tier-5 combo (depth 5 = customer, 6 = item, 7 = description). */
export function export2ToNodes(subtree: Export2Subtree, parentPath: string[]): TreeNode[] {
	return subtree.customers.map((c) => {
		const custPath = [...parentPath, c.customer];
		const items: TreeNode[] = c.items.map((it) => {
			const itemPath = [...custPath, it.item];
			const descChildren: TreeNode[] = (it.descriptions ?? []).map((d) => ({
				label: d.description,
				depth: 7,
				path: [...itemPath, d.description],
				rev_2025: d.rev_2025,
				rev_2026: d.rev_2026,
				cost_2025: d.cost_2025,
				cost_2026: d.cost_2026,
				margin_pct_2025: d.margin_pct_2025,
				margin_pct_2026: d.margin_pct_2026,
				impact_usd: d.impact_usd ?? 0,
				flags: [],
				isLeaf: true,
				combo_hash: null,
				leaf: null,
				children: []
			}));
			return {
				label: it.item,
				depth: 6,
				path: itemPath,
				rev_2025: it.rev_2025,
				rev_2026: it.rev_2026,
				cost_2025: it.cost_2025,
				cost_2026: it.cost_2026,
				margin_pct_2025: it.margin_pct_2025,
				margin_pct_2026: it.margin_pct_2026,
				impact_usd: it.impact_usd ?? 0,
				flags: [],
				isLeaf: descChildren.length === 0,
				combo_hash: null,
				leaf: null,
				children: descChildren
			};
		});
		return {
			label: c.customer,
			depth: 5,
			path: custPath,
			rev_2025: c.rev_2025,
			rev_2026: c.rev_2026,
			cost_2025: c.cost_2025,
			cost_2026: c.cost_2026,
			margin_pct_2025: c.margin_pct_2025,
			margin_pct_2026: c.margin_pct_2026,
			impact_usd: c.impact_usd ?? 0,
			flags: [],
			isLeaf: false,
			combo_hash: null,
			leaf: null,
			children: items
		};
	});
}

/** Wrap a flat RankedImpact row as a depth-4 combo leaf node (used by flat-mode
 *  selection so the same `TreeNode` selection path works in both view modes). */
export function rankedImpactToLeafNode(r: RankedImpact): TreeNode {
	return {
		label: r.combo[r.combo.length - 1],
		depth: 4,
		path: [...r.combo],
		rev_2025: r.rev_2025,
		rev_2026: r.rev_2026,
		cost_2025: r.cost_2025,
		cost_2026: r.cost_2026,
		margin_pct_2025: r.margin_pct_2025,
		margin_pct_2026: r.margin_pct_2026,
		impact_usd: r.impact_usd ?? 0,
		flags: r.flags,
		isLeaf: true,
		combo_hash: r.combo_hash,
		leaf: r,
		children: []
	};
}
