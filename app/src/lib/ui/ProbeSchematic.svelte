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
	 *
	 * In capture mode, when `onZoneActivate` is supplied, the diagram IS the
	 * capture control (Revisions 2): each zone segment becomes a
	 * keyboard-focusable button that opens a file picker for that zone. A
	 * captured zone shows its thumbnail (if given) clipped into its own
	 * shape, plus a small check badge.
	 */

	interface Props {
		mode: 'capture' | 'findings';
		zones?: ProbeZone[];
		/** zone key → thumbnail data URL, rendered clipped inside a captured zone's shape. */
		thumbnails?: Record<string, string>;
		/** Present + mode === 'capture' makes every zone a focusable capture control. */
		onZoneActivate?: (key: string) => void;
	}

	let { mode, zones = [], thumbnails, onZoneActivate }: Props = $props();

	const interactive = $derived(mode === 'capture' && !!onZoneActivate);

	// Fixed left→right geometry. The probe's physical layout is the same in
	// every render — only per-zone state/severity varies — so position and
	// label are canonical, not derived from the caller. `clip` is each zone's
	// bounding box, used to mask a captured-image thumbnail into its shape.
	const CANON: {
		key: string;
		label: string;
		labelX: number;
		clip: [number, number, number, number];
	}[] = [
		{ key: 'lens', label: 'Lens', labelX: 88, clip: [88, 42, 42, 84] },
		{ key: 'housing', label: 'Housing', labelX: 205, clip: [130, 42, 150, 84] },
		{ key: 'strain', label: 'Strain relief', labelX: 305, clip: [280, 42, 50, 84] },
		{ key: 'cable', label: 'Cable', labelX: 445, clip: [330, 40, 230, 88] },
		{ key: 'connector', label: 'Connector', labelX: 605, clip: [560, 46, 90, 68] }
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

	function zoneAriaLabel(z: (typeof merged)[number]): string {
		return z.state === 'captured'
			? `${z.label} zone, photo captured — activate to replace`
			: `${z.label} zone — activate to capture a photo`;
	}

	function handleKeydown(e: KeyboardEvent, key: string) {
		if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
		e.preventDefault();
		onZoneActivate?.(key);
	}
</script>

<figure class="schematic">
	<svg viewBox="0 0 680 168" role="img" aria-label="Probe schematic, {mode} mode">
		{#if interactive}
			{#each merged as z (z.key)}
				{#if thumbnails?.[z.key]}
					<clipPath id="clip-{z.key}">
						<rect x={z.clip[0]} y={z.clip[1]} width={z.clip[2]} height={z.clip[3]} rx="6" />
					</clipPath>
				{/if}
			{/each}
		{/if}

		<!-- Lens: convex tip, bulging left. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -- role="button" makes this interactive; the a11y check doesn't evaluate the dynamic role expression. -->
		<g
			class="zone {zoneClass(merged[0])}"
			class:zone-interactive={interactive}
			role={interactive ? 'button' : undefined}
			tabindex={interactive ? 0 : undefined}
			aria-label={interactive ? zoneAriaLabel(merged[0]) : undefined}
			onclick={interactive ? () => onZoneActivate?.(merged[0].key) : undefined}
			onkeydown={interactive ? (e: KeyboardEvent) => handleKeydown(e, merged[0].key) : undefined}
		>
			<path class="shape" d="M130,42 L88,42 A42,42 0 0 0 88,126 L130,126 Z" />
			{#if interactive && thumbnails?.[merged[0].key]}
				<image
					href={thumbnails[merged[0].key]}
					x={merged[0].clip[0]}
					y={merged[0].clip[1]}
					width={merged[0].clip[2]}
					height={merged[0].clip[3]}
					clip-path="url(#clip-lens)"
					preserveAspectRatio="xMidYMid slice"
					opacity="0.88"
				/>
			{/if}
		</g>

		<!-- Housing: main body. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -- role="button" makes this interactive; the a11y check doesn't evaluate the dynamic role expression. -->
		<g
			class="zone {zoneClass(merged[1])}"
			class:zone-interactive={interactive}
			role={interactive ? 'button' : undefined}
			tabindex={interactive ? 0 : undefined}
			aria-label={interactive ? zoneAriaLabel(merged[1]) : undefined}
			onclick={interactive ? () => onZoneActivate?.(merged[1].key) : undefined}
			onkeydown={interactive ? (e: KeyboardEvent) => handleKeydown(e, merged[1].key) : undefined}
		>
			<rect class="shape" x="130" y="42" width="150" height="84" rx="10" />
			{#if interactive && thumbnails?.[merged[1].key]}
				<image
					href={thumbnails[merged[1].key]}
					x={merged[1].clip[0]}
					y={merged[1].clip[1]}
					width={merged[1].clip[2]}
					height={merged[1].clip[3]}
					clip-path="url(#clip-housing)"
					preserveAspectRatio="xMidYMid slice"
					opacity="0.88"
				/>
			{/if}
		</g>

		<!-- Strain relief boot: tapers from housing height to cable diameter. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -- role="button" makes this interactive; the a11y check doesn't evaluate the dynamic role expression. -->
		<g
			class="zone {zoneClass(merged[2])}"
			class:zone-interactive={interactive}
			role={interactive ? 'button' : undefined}
			tabindex={interactive ? 0 : undefined}
			aria-label={interactive ? zoneAriaLabel(merged[2]) : undefined}
			onclick={interactive ? () => onZoneActivate?.(merged[2].key) : undefined}
			onkeydown={interactive ? (e: KeyboardEvent) => handleKeydown(e, merged[2].key) : undefined}
		>
			<path class="shape" d="M280,42 L330,64 L330,104 L280,126 Z" />
			{#if interactive && thumbnails?.[merged[2].key]}
				<image
					href={thumbnails[merged[2].key]}
					x={merged[2].clip[0]}
					y={merged[2].clip[1]}
					width={merged[2].clip[2]}
					height={merged[2].clip[3]}
					clip-path="url(#clip-strain)"
					preserveAspectRatio="xMidYMid slice"
					opacity="0.88"
				/>
			{/if}
		</g>

		<!-- Cable: gentle curve. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -- role="button" makes this interactive; the a11y check doesn't evaluate the dynamic role expression. -->
		<g
			class="zone {zoneClass(merged[3])}"
			class:zone-interactive={interactive}
			role={interactive ? 'button' : undefined}
			tabindex={interactive ? 0 : undefined}
			aria-label={interactive ? zoneAriaLabel(merged[3]) : undefined}
			onclick={interactive ? () => onZoneActivate?.(merged[3].key) : undefined}
			onkeydown={interactive ? (e: KeyboardEvent) => handleKeydown(e, merged[3].key) : undefined}
		>
			<!-- A wide, invisible hit-area under the thin cable stroke — the
			     drawn curve alone is too thin a target to click/tap reliably. -->
			<path class="hit-area" d="M330,84 C400,40 460,128 560,84" />
			<path class="shape cable-path" d="M330,84 C400,40 460,128 560,84" />
			{#if interactive && thumbnails?.[merged[3].key]}
				<image
					href={thumbnails[merged[3].key]}
					x={merged[3].clip[0]}
					y={merged[3].clip[1]}
					width={merged[3].clip[2]}
					height={merged[3].clip[3]}
					clip-path="url(#clip-cable)"
					preserveAspectRatio="xMidYMid slice"
					opacity="0.88"
				/>
			{/if}
		</g>

		<!-- Connector block, with a small keyed tab. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -- role="button" makes this interactive; the a11y check doesn't evaluate the dynamic role expression. -->
		<g
			class="zone {zoneClass(merged[4])}"
			class:zone-interactive={interactive}
			role={interactive ? 'button' : undefined}
			tabindex={interactive ? 0 : undefined}
			aria-label={interactive ? zoneAriaLabel(merged[4]) : undefined}
			onclick={interactive ? () => onZoneActivate?.(merged[4].key) : undefined}
			onkeydown={interactive ? (e: KeyboardEvent) => handleKeydown(e, merged[4].key) : undefined}
		>
			<rect class="shape" x="560" y="54" width="90" height="60" rx="6" />
			<rect class="shape tab" x="592" y="46" width="26" height="10" rx="2" />
			{#if interactive && thumbnails?.[merged[4].key]}
				<image
					href={thumbnails[merged[4].key]}
					x={merged[4].clip[0]}
					y={merged[4].clip[1]}
					width={merged[4].clip[2]}
					height={merged[4].clip[3]}
					clip-path="url(#clip-connector)"
					preserveAspectRatio="xMidYMid slice"
					opacity="0.88"
				/>
			{/if}
		</g>

		{#if mode === 'findings'}
			{#each merged as z (z.key)}
				<circle class="signal-dot sev-{z.severity}" cx={z.labelX} cy="18" r="5" />
			{/each}
		{/if}

		{#if interactive}
			{#each merged as z (z.key)}
				{#if z.state === 'captured'}
					<g class="check-badge" transform="translate({z.labelX},30)">
						<circle r="7" />
						<path d="M-3,0 L-1,2.4 L3.4,-2.6" />
					</g>
				{/if}
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

	.hit-area {
		stroke: transparent;
		stroke-width: 24;
		fill: none;
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

	/* Interactive (capture) zones — each `<g>` is a keyboard-focusable button. */
	.zone-interactive {
		cursor: pointer;
	}

	.zone-interactive:hover .shape {
		stroke: var(--accent-ink);
	}

	.zone-interactive:focus-visible {
		outline: none;
	}

	.zone-interactive:focus-visible .shape {
		stroke: var(--accent);
		stroke-width: 2.5;
	}

	.check-badge circle {
		fill: var(--sev-pass);
	}

	.check-badge path {
		fill: none;
		stroke: #fff;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
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
