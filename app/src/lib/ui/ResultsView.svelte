<script lang="ts">
	import type { AnalyzeResult } from '$lib/domain/probe';
	import ProbeSchematic, { type ProbeZone, type Severity } from './ProbeSchematic.svelte';

	interface Props {
		result: AnalyzeResult;
	}

	let { result }: Props = $props();

	const ZONE_DEFS: { key: string; label: string; match: string[] }[] = [
		{ key: 'lens', label: 'Lens', match: ['lens'] },
		{ key: 'housing', label: 'Housing', match: ['hous'] },
		{ key: 'strain', label: 'Strain relief', match: ['strain'] },
		{ key: 'cable', label: 'Cable', match: ['cable'] },
		{ key: 'connector', label: 'Connector', match: ['connector', 'conn'] }
	];

	/** Matches a finding's free-text zone against a canonical schematic zone key. */
	function zoneKeyFor(zoneText: string): string | null {
		const lower = zoneText.toLowerCase();
		return ZONE_DEFS.find((z) => z.match.some((m) => lower.includes(m)))?.key ?? null;
	}

	/** Normalizes the AI's free-text severity into the fixed signal vocabulary. */
	function normalizeSeverity(raw: string): Severity {
		const lower = raw.toLowerCase();
		if (lower.includes('major') || lower.includes('critical') || lower.includes('severe'))
			return 'major';
		if (lower.includes('moderate')) return 'moderate';
		if (lower.includes('minor') || lower.includes('cosmetic')) return 'minor';
		if (lower.includes('pass') || lower.includes('ok') || lower.includes('good')) return 'pass';
		return 'flag';
	}

	const SEV_RANK: Record<Severity, number> = { major: 0, moderate: 1, minor: 2, flag: 3, pass: 4 };

	/** One dot per canonical zone: worst matching finding's severity, or 'pass'. */
	const schematicZones = $derived.by((): ProbeZone[] =>
		ZONE_DEFS.map((z) => {
			const matches = result.findings.filter((f) => zoneKeyFor(f.zone) === z.key);
			if (!matches.length) return { key: z.key, label: z.label, severity: 'pass' as Severity };
			const severity = matches
				.map((f) => normalizeSeverity(f.severity))
				.sort((a, b) => SEV_RANK[a] - SEV_RANK[b])[0];
			return { key: z.key, label: z.label, severity };
		})
	);

	function priorityClass(priority: string): 'required' | 'recommended' | 'optional' {
		const lower = priority.toLowerCase();
		if (lower.includes('require')) return 'required';
		if (lower.includes('recommend')) return 'recommended';
		return 'optional';
	}
</script>

<div class="results">
	<div class="probe-id">
		<span class="probe-id-name">{result.probeId.model ?? '—'} · {result.probeId.mfg ?? '—'}</span>
		<span class="probe-id-codes mono">
			{#if result.probeId.sn}<span>S/N {result.probeId.sn}</span>{/if}
			{#if result.probeId.ref}<span>REF {result.probeId.ref}</span>{/if}
		</span>
	</div>

	<ProbeSchematic mode="findings" zones={schematicZones} />

	<section class="results-section">
		<h2 class="eyebrow">Findings</h2>
		{#if result.findings.length}
			<div class="finding-list">
				{#each result.findings as f, i (i)}
					<div class="finding-row">
						<span class="sev-dot {normalizeSeverity(f.severity)}" aria-hidden="true"></span>
						<div class="finding-body">
							<div class="finding-hdr">
								<span class="finding-zone">{f.zone}</span>
								<span class="finding-source mono">{f.source}</span>
							</div>
							<p class="finding-desc">{f.description}</p>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<p class="empty-line">No findings.</p>
		{/if}
	</section>

	<section class="results-section">
		<h2 class="eyebrow">Repair quote</h2>
		{#if result.quoteItems.length}
			<div class="quote-list">
				{#each result.quoteItems as q, i (i)}
					<div class="quote-row">
						<div class="quote-hdr">
							<span class="quote-item">{q.item}</span>
							<span class="pill-priority {priorityClass(q.priority)}">{q.priority}</span>
						</div>
						<p class="quote-rationale">{q.rationale}</p>
					</div>
				{/each}
			</div>
		{:else}
			<p class="empty-line">No quote items.</p>
		{/if}
	</section>

	<section class="results-section overall">
		<div>
			<span class="eyebrow">Overall condition</span>
			<div class="overall-value">{result.overallCondition}</div>
		</div>
		<div>
			<span class="eyebrow">Confidence</span>
			<div class="overall-value mono">{result.confidence}%</div>
		</div>
	</section>
</div>

<style>
	.results {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.probe-id {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
	}

	.probe-id-name {
		font-weight: 600;
		font-size: 14px;
		color: var(--ink);
	}

	.probe-id-codes {
		display: flex;
		gap: 12px;
		font-size: 11px;
		color: var(--ink-2);
	}

	.results-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.finding-list,
	.quote-list {
		display: flex;
		flex-direction: column;
	}

	.overall {
		flex-direction: row;
		gap: 28px;
		border-top: 1px solid var(--line);
		padding-top: 14px;
	}

	.overall-value {
		font-weight: 600;
		font-size: 15px;
		color: var(--ink);
		margin-top: 2px;
	}
</style>
