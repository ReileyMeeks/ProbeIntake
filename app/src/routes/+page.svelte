<script lang="ts">
	import type { AnalyzeResult, CapturedImage, ProbeMeta } from '$lib/domain/probe';
	import { postAnalyze } from '$lib/api/client';
	import { intakeStatus } from '$lib/domain/status.svelte';
	import IntakeForm from '$lib/forms/IntakeForm.svelte';
	import CapturePanel from '$lib/forms/CapturePanel.svelte';
	import ProbeSchematic, { type ProbeZone } from '$lib/ui/ProbeSchematic.svelte';
	import ResultsView from '$lib/ui/ResultsView.svelte';

	const CAPTURE_ZONES: { key: string; label: string }[] = [
		{ key: 'lens', label: 'Lens' },
		{ key: 'housing', label: 'Housing' },
		{ key: 'strain', label: 'Strain relief' },
		{ key: 'cable', label: 'Cable' },
		{ key: 'connector', label: 'Connector' }
	];

	let meta = $state<ProbeMeta>({});
	let images = $state<CapturedImage[]>([]);
	let analyzing = $state(false);
	let result = $state<AnalyzeResult | null>(null);
	let errorMessage = $state('');

	// Mirrors the intake's WO# / analyze status into the top strip, which
	// lives in a sibling `+layout.svelte` with no direct prop path here.
	$effect(() => {
		intakeStatus.status = analyzing ? 'analyzing' : 'ready';
		intakeStatus.woNumber = meta.so ?? '';
	});

	const captureZones = $derived.by((): ProbeZone[] => {
		const firstPendingIdx = CAPTURE_ZONES.findIndex(
			(z) => !images.some((img) => img.zone === z.key)
		);
		return CAPTURE_ZONES.map((z, i) => {
			const captured = images.some((img) => img.zone === z.key);
			return {
				key: z.key,
				label: z.label,
				state: captured ? 'captured' : i === firstPendingIdx ? 'current' : 'pending'
			};
		});
	});

	// ?demo=1 seeds a fixture result so the populated state can be screenshotted
	// / reviewed without running a real analysis. Reads location directly
	// (rather than $app/state) so this component behaves the same whether it's
	// rendered inside the SvelteKit router or in isolation (e.g. under test).
	const isDemo =
		typeof window !== 'undefined' &&
		new URLSearchParams(window.location.search).get('demo') === '1';

	const DEMO_RESULT: AnalyzeResult = {
		probeId: { model: 'C1-6-D', mfg: 'GE Healthcare', sn: '250840YP6', ref: '5418916' },
		findings: [
			{
				zone: 'Strain Relief',
				description: 'Visible cracking and separation at the boot-to-cable junction.',
				severity: 'major',
				source: 'image:strain'
			},
			{
				zone: 'Housing',
				description: 'Hairline stress crack along the seam, non-through.',
				severity: 'moderate',
				source: 'image:housing'
			},
			{
				zone: 'Lens',
				description: 'Minor surface scuffing, no delamination observed.',
				severity: 'minor',
				source: 'image:lens'
			}
		],
		quoteItems: [
			{
				item: 'Retermination',
				priority: 'Required',
				rationale: 'Strain relief failure risks cable conductor damage in service.'
			},
			{
				item: 'Housing Reseal',
				priority: 'Required',
				rationale: 'Seam crack compromises the housing seal; reseal to restore ingress protection.'
			},
			{
				item: 'Cosmetic buff — lens',
				priority: 'Optional',
				rationale: 'Scuffing is cosmetic only and does not affect image quality.'
			}
		],
		overallCondition: 'Fair',
		confidence: 62,
		notes: ''
	};

	if (isDemo) result = DEMO_RESULT;

	async function analyze() {
		errorMessage = '';
		result = null;
		analyzing = true;
		try {
			result = await postAnalyze({ meta, images });
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Analysis failed.';
		} finally {
			analyzing = false;
		}
	}
</script>

<svelte:head>
	<title>Avante Probe Intake</title>
</svelte:head>

<div class="workspace">
	<section class="card intake-pane">
		<div class="pane-hdr">
			<h1 class="eyebrow">Intake</h1>
		</div>
		<div class="pane-body">
			<IntakeForm bind:meta />

			<div>
				<h2 class="eyebrow" style="margin-bottom: 8px;">Probe zones</h2>
				<ProbeSchematic mode="capture" zones={captureZones} />
			</div>

			<CapturePanel bind:images />

			<button type="button" class="btn btn-primary" disabled={analyzing} onclick={analyze}>
				{analyzing ? 'Analyzing…' : 'Analyze probe'}
			</button>
		</div>
	</section>

	<section class="card quote-pane">
		<div class="pane-hdr">
			<h1 class="eyebrow">Quote</h1>
		</div>
		<div class="pane-body">
			{#if errorMessage}
				<p class="error-line" role="alert">{errorMessage}</p>
			{:else if result}
				<ResultsView {result} />
			{:else}
				<p class="empty-line">Run analysis to generate a repair quote.</p>
			{/if}
		</div>
	</section>
</div>
