<script module lang="ts">
	/** Severity signal used by the findings-mode schematic + legend. */
	export type Severity = 'major' | 'moderate' | 'minor' | 'pass' | 'flag';

	export interface ProbeZone {
		key: string;
		label: string;
		state?: 'pending' | 'current' | 'captured';
		severity?: Severity;
	}
</script>

<script lang="ts">
	/**
	 * The signature element: a clean SVG side-view of a convex probe drawn as
	 * geometric segments left→right — lens (convex tip) → housing → strain
	 * relief boot → cable → connector block. Each segment is one of the five
	 * canonical zones and carries state (capture) or a severity signal
	 * (findings). See docs/superpowers/specs/2026-07-09-bench-instrument-design.md.
	 */

	interface Props {
		mode: 'capture' | 'findings';
		zones?: ProbeZone[];
	}

	let { mode, zones = [] }: Props = $props();

	// Fixed left→right geometry. The probe's physical layout is the same in
	// every render — only per-zone state/severity varies — so position and
	// label are canonical, not derived from the caller.
	const CANON: { key: string; label: string; labelX: number }[] = [
		{ key: 'lens', label: 'Lens', labelX: 88 },
		{ key: 'housing', label: 'Housing', labelX: 205 },
		{ key: 'strain', label: 'Strain relief', labelX: 305 },
		{ key: 'cable', label: 'Cable', labelX: 445 },
		{ key: 'connector', label: 'Connector', labelX: 605 }
	];

	const SEV_LEGEND: { key: Severity; label: string }[] = [
		{ key: 'major', label: 'Major' },
		{ key: 'moderate', label: 'Moderate' },
		{ key: 'minor', label: 'Minor' },
		{ key: 'pass', label: 'Pass' }
	];

	const merged = $derived.by(() => {
		const byKey = new Map(zones.map((z) => [z.key, z]));
		return CANON.map((c) => {
			const z = byKey.get(c.key);
			return {
				...c,
				label: z?.label ?? c.label,
				state: z?.state ?? 'pending',
				severity: z?.severity ?? (mode === 'findings' ? 'pass' : undefined)
			};
		});
	});

	function zoneClass(z: (typeof merged)[number]): string {
		return mode === 'capture' ? `zone-${z.state}` : `sev-${z.severity}`;
	}
</script>

<figure class="schematic">
	<svg viewBox="0 0 680 168" role="img" aria-label="Probe schematic, {mode} mode">
		<!-- Lens: convex tip, bulging left. -->
		<g class="zone {zoneClass(merged[0])}">
			<path class="shape" d="M130,42 L88,42 A42,42 0 0 0 88,126 L130,126 Z" />
		</g>

		<!-- Housing: main body. -->
		<g class="zone {zoneClass(merged[1])}">
			<rect class="shape" x="130" y="42" width="150" height="84" rx="10" />
		</g>

		<!-- Strain relief boot: tapers from housing height to cable diameter. -->
		<g class="zone {zoneClass(merged[2])}">
			<path class="shape" d="M280,42 L330,64 L330,104 L280,126 Z" />
		</g>

		<!-- Cable: gentle curve. -->
		<g class="zone {zoneClass(merged[3])}">
			<path class="shape cable-path" d="M330,84 C400,40 460,128 560,84" />
		</g>

		<!-- Connector block, with a small keyed tab. -->
		<g class="zone {zoneClass(merged[4])}">
			<rect class="shape" x="560" y="54" width="90" height="60" rx="6" />
			<rect class="shape tab" x="592" y="46" width="26" height="10" rx="2" />
		</g>

		{#if mode === 'findings'}
			{#each merged as z (z.key)}
				<circle class="signal-dot sev-{z.severity}" cx={z.labelX} cy="18" r="5" />
			{/each}
		{/if}

		{#each merged as z (z.key)}
			<text class="zone-label" x={z.labelX} y="150" text-anchor="middle">{z.label}</text>
		{/each}
	</svg>

	{#if mode === 'findings'}
		<figcaption class="legend">
			{#each SEV_LEGEND as l (l.key)}
				<span class="legend-item">
					<span class="legend-dot sev-{l.key}" aria-hidden="true"></span>
					{l.label}
				</span>
			{/each}
		</figcaption>
	{/if}
</figure>

<style>
	.schematic {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	svg {
		width: 100%;
		height: auto;
		display: block;
	}

	.shape {
		fill: none;
		stroke: var(--line);
		stroke-width: 1.5;
		transition:
			stroke 0.2s,
			fill 0.2s;
	}

	.cable-path {
		stroke-width: 3;
		stroke-linecap: round;
	}

	.zone-label {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.02em;
		fill: var(--ink-3);
	}

	/* ── Capture mode ──────────────────────────────────────────────── */

	.zone-captured .shape {
		stroke: var(--accent);
		fill: var(--accent-wash);
	}

	.zone-current .shape {
		stroke: var(--accent);
		fill: var(--accent-wash);
	}

	.zone-current .shape {
		animation: probe-pulse 1.8s ease-in-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.zone-current .shape {
			animation: none;
		}
	}

	@keyframes probe-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* ── Findings mode ─────────────────────────────────────────────── */

	.signal-dot {
		stroke: var(--surface);
		stroke-width: 1.5;
	}

	/* Shared by the SVG signal dots (need `fill`) and the HTML legend dots
	   (need `background`) — harmless no-op on whichever property doesn't
	   apply to a given element. */
	.sev-major {
		fill: var(--sev-major);
		background: var(--sev-major);
	}
	.sev-moderate {
		fill: var(--sev-moderate);
		background: var(--sev-moderate);
	}
	.sev-minor {
		fill: var(--sev-minor);
		background: var(--sev-minor);
	}
	.sev-pass {
		fill: var(--sev-pass);
		background: var(--sev-pass);
	}
	.sev-flag {
		fill: var(--sev-flag);
		background: var(--sev-flag);
	}

	g.sev-major .shape {
		stroke: var(--sev-major);
	}
	g.sev-moderate .shape {
		stroke: var(--sev-moderate);
	}
	g.sev-minor .shape {
		stroke: var(--sev-minor);
	}
	g.sev-pass .shape {
		stroke: var(--line);
	}
	g.sev-flag .shape {
		stroke: var(--sev-flag);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-3);
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}

	.legend-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
