import { describe, it, expect } from 'vitest';
import {
	buildTierTree,
	filterRows,
	limitChildren,
	allFlags,
	export2ToNodes,
	rankedImpactToLeafNode,
	type TreeFilters
} from './tree';
import type { RankedImpact, Export2Subtree } from './types';

function row(
	combo: string[],
	rev25: number,
	rev26: number,
	cost25: number,
	cost26: number,
	impact: number | null,
	flags: string[] = []
): RankedImpact {
	return {
		combo_hash: combo.join('|'),
		combo: combo as RankedImpact['combo'],
		rev_2025: rev25,
		rev_2026: rev26,
		cost_2025: cost25,
		cost_2026: cost26,
		margin_pct_2025: rev25 ? 1 - cost25 / rev25 : null,
		margin_pct_2026: rev26 ? 1 - cost26 / rev26 : null,
		impact_usd: impact,
		flags
	};
}

describe('buildTierTree', () => {
	it('groups level 1 and sums revenue/impact', () => {
		const rows = [
			row(['Industrial', 'Direct', 'Contract', 'A', 'New'], 100, 100, 60, 64, 4),
			row(['Industrial', 'Direct', 'Spot', 'A', 'New'], 100, 100, 60, 66, 6),
			row(['Consumer', 'Direct', 'Contract', 'A', 'New'], 50, 50, 30, 31, 1)
		];
		const tree = buildTierTree(rows);
		expect(tree.map((n) => n.label)).toEqual(['Industrial', 'Consumer']); // sorted by |impact| desc
		const industrial = tree[0];
		expect(industrial.rev_2026).toBe(200);
		expect(industrial.impact_usd).toBe(10);
		expect(industrial.depth).toBe(0);
		expect(industrial.isLeaf).toBe(false);
	});

	it('computes revenue-weighted margins from summed cost/rev', () => {
		const rows = [
			row(['Industrial', 'Direct', 'Contract', 'A', 'New'], 100, 100, 60, 64, 4),
			row(['Industrial', 'Direct', 'Spot', 'A', 'New'], 100, 100, 60, 66, 6)
		];
		const industrial = buildTierTree(rows)[0];
		expect(industrial.margin_pct_2026).toBeCloseTo(0.35, 6);
		expect(industrial.margin_pct_2025).toBeCloseTo(0.4, 6);
	});

	it('marks depth-4 nodes as leaves carrying the original combo_hash', () => {
		const rows = [row(['Industrial', 'Direct', 'Contract', 'A', 'New'], 100, 100, 60, 64, 4)];
		let n = buildTierTree(rows)[0];
		while (n.children.length) n = n.children[0];
		expect(n.depth).toBe(4);
		expect(n.isLeaf).toBe(true);
		expect(n.combo_hash).toBe('Industrial|Direct|Contract|A|New');
		expect(n.label).toBe('New');
	});

	it('children are exactly one depth deeper than their parent', () => {
		const rows = [row(['Industrial', 'Direct', 'Contract', 'A', 'New'], 100, 100, 60, 64, 4)];
		const root = buildTierTree(rows)[0];
		expect(root.children[0].label).toBe('Direct');
		expect(root.children[0].depth).toBe(1);
	});

	it('excludes null impact from aggregated sums', () => {
		const rows = [
			row(['Industrial', 'Direct', 'Contract', 'A', 'New'], 100, 100, 60, 64, 4),
			row(['Industrial', 'Direct', 'Spot', 'A', 'New'], 100, 100, 60, 66, null)
		];
		const industrial = buildTierTree(rows)[0];
		expect(industrial.impact_usd).toBe(4); // null row contributes 0
		expect(industrial.rev_2026).toBe(200); // revenue still summed
	});

	it('unions flags across all leaves beneath a node', () => {
		const rows = [
			row(['Industrial', 'Direct', 'Contract', 'A', 'New'], 100, 100, 60, 64, 4, ['cost_spike']),
			row(['Industrial', 'Direct', 'Spot', 'A', 'New'], 100, 100, 60, 66, 6, [
				'mix_drop',
				'cost_spike'
			])
		];
		const industrial = buildTierTree(rows)[0];
		expect([...industrial.flags].sort()).toEqual(['cost_spike', 'mix_drop']);
	});
});

describe('filterRows', () => {
	const rows = [
		row(['Industrial', 'Direct', 'Contract', 'A', 'New'], 100, 100, 60, 64, 4, ['cost_spike']),
		row(['Industrial', 'Direct', 'Spot', 'A', 'New'], 100, 100, 60, 56, -6, []),
		row(['Consumer', 'Direct', 'Contract', 'A', 'New'], 50, 50, 30, 31, 1, ['mix_drop'])
	];

	it('keeps everything with empty filters', () => {
		const f: TreeFilters = { search: '', deterioratingOnly: false, flags: [], minImpact: 0 };
		expect(filterRows(rows, f)).toHaveLength(3);
	});

	it('deterioratingOnly keeps impact > 0', () => {
		const f: TreeFilters = { search: '', deterioratingOnly: true, flags: [], minImpact: 0 };
		const out = filterRows(rows, f);
		expect(out.map((r) => r.impact_usd)).toEqual([4, 1]);
	});

	it('minImpact filters by absolute impact', () => {
		const f: TreeFilters = { search: '', deterioratingOnly: false, flags: [], minImpact: 5 };
		expect(filterRows(rows, f).map((r) => r.impact_usd)).toEqual([-6]);
	});

	it('flag filter keeps rows carrying any selected flag', () => {
		const f: TreeFilters = {
			search: '',
			deterioratingOnly: false,
			flags: ['mix_drop'],
			minImpact: 0
		};
		expect(filterRows(rows, f)).toHaveLength(1);
		expect(filterRows(rows, f)[0].combo[0]).toBe('Consumer');
	});

	it('search matches any combo segment, case-insensitive', () => {
		const f: TreeFilters = { search: 'spot', deterioratingOnly: false, flags: [], minImpact: 0 };
		expect(filterRows(rows, f)).toHaveLength(1);
	});

	it('treats null impact as 0 for deterioratingOnly and minImpact', () => {
		const nullRows = [
			row(['X', 'D', 'C', 'A', 'New'], 100, 100, 60, 60, null),
			row(['Y', 'D', 'C', 'A', 'New'], 100, 100, 60, 64, 4)
		];
		const det: TreeFilters = { search: '', deterioratingOnly: true, flags: [], minImpact: 0 };
		expect(filterRows(nullRows, det).map((r) => r.combo[0])).toEqual(['Y']); // null excluded as 0
		const min: TreeFilters = { search: '', deterioratingOnly: false, flags: [], minImpact: 1 };
		expect(filterRows(nullRows, min).map((r) => r.combo[0])).toEqual(['Y']); // |0| < 1 excluded
	});
});

describe('limitChildren', () => {
	it('returns the first N nodes and the hidden count', () => {
		const rows = Array.from({ length: 7 }, (_, i) =>
			row([`B${i}`, 'D', 'C', 'A', 'N'], 100, 100, 60, 60 + i, i)
		);
		const tree = buildTierTree(rows);
		const { shown, hiddenCount } = limitChildren(tree, 5);
		expect(shown).toHaveLength(5);
		expect(hiddenCount).toBe(2);
	});
});

describe('allFlags', () => {
	it('returns the sorted unique union of flags', () => {
		const rows = [
			row(['A', 'D', 'C', 'A', 'New'], 100, 100, 60, 64, 4, ['zeta', 'cost_spike']),
			row(['B', 'D', 'C', 'A', 'New'], 100, 100, 60, 64, 4, ['cost_spike', 'mix_drop'])
		];
		expect(allFlags(rows)).toEqual(['cost_spike', 'mix_drop', 'zeta']);
	});
});

function subtree(): Export2Subtree {
	return {
		available: true,
		customers: [
			{
				customer: 'Cust A',
				rev_2025: 100,
				rev_2026: 120,
				cost_2025: 60,
				cost_2026: 90,
				margin_pct_2025: 0.4,
				margin_pct_2026: 0.25,
				impact_usd: 18,
				items: [
					{
						item: 'Used',
						rev_2025: 100,
						rev_2026: 120,
						cost_2025: 60,
						cost_2026: 90,
						margin_pct_2025: 0.4,
						margin_pct_2026: 0.25,
						impact_usd: 18,
						descriptions: [
							{
								description: 'Bracket',
								rev_2025: 100,
								rev_2026: 120,
								cost_2025: 60,
								cost_2026: 90,
								margin_pct_2025: 0.4,
								margin_pct_2026: 0.25,
								impact_usd: 18
							}
						]
					}
				]
			}
		]
	};
}

describe('export2ToNodes description tier', () => {
	it('builds customer(5) -> item(6) -> description(7) nodes', () => {
		const nodes = export2ToNodes(subtree(), ['Ind', 'Direct', 'S', 'R', 'New']);
		const cust = nodes[0];
		expect(cust.depth).toBe(5);
		const item = cust.children[0];
		expect(item.depth).toBe(6);
		expect(item.isLeaf).toBe(false);
		const desc = item.children[0];
		expect(desc.depth).toBe(7);
		expect(desc.isLeaf).toBe(true);
		expect(desc.label).toBe('Bracket');
	});

	it('item with no descriptions stays a leaf', () => {
		const st = subtree();
		st.customers[0].items[0].descriptions = [];
		const item = export2ToNodes(st, ['Ind', 'Direct', 'S', 'R', 'New'])[0].children[0];
		expect(item.isLeaf).toBe(true);
		expect(item.children.length).toBe(0);
	});
});

describe('rankedImpactToLeafNode', () => {
	it('wraps a flat row as a depth-4 combo leaf node', () => {
		const r = row(['Ind', 'Direct', 'S', 'R', 'New'], 100, 120, 60, 90, 18);
		const n = rankedImpactToLeafNode(r);
		expect(n.depth).toBe(4);
		expect(n.isLeaf).toBe(true);
		expect(n.combo_hash).toBe(r.combo_hash);
		expect(n.leaf).toBe(r);
		expect(n.children.length).toBe(0);
	});
});
