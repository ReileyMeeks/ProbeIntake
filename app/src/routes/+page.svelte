<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import type { AnalyzeResult, CapturedImage, ProbeMeta } from '$lib/domain/probe';
	import { postAnalyze } from '$lib/api/client';
	import { intakeStatus } from '$lib/domain/status.svelte';
	import IntakeForm from '$lib/forms/IntakeForm.svelte';
	import CapturePanel from '$lib/forms/CapturePanel.svelte';
	import InspectionForm from '$lib/forms/InspectionForm.svelte';
	import ResultsView from '$lib/ui/ResultsView.svelte';

	let meta = $state<ProbeMeta>({});
	let images = $state<CapturedImage[]>([]);
	let analyzing = $state(false);
	let result = $state<AnalyzeResult | null>(null);
	let errorMessage = $state('');

	// Intake and Quote are transitioned views, not side-by-side panes
	// (Revisions 2, 2026-07-09) — meta/images/result all stay in memory
	// across the swap, so navigating back to intake never loses work.
	let view = $state<'intake' | 'quote'>('intake');

	// Mirrors the intake's WO# / analyze status into the top strip, which
	// lives in a sibling `+layout.svelte` with no direct prop path here.
	$effect(() => {
		intakeStatus.status = analyzing ? 'analyzing' : 'ready';
		intakeStatus.woNumber = meta.so ?? '';
	});

	const reduceMotion =
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const transitionMs = reduceMotion ? 0 : 220;

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

	if (isDemo) {
		result = DEMO_RESULT;
		view = 'quote';
	}

	async function analyze() {
		errorMessage = '';
		analyzing = true;
		try {
			result = await postAnalyze({ meta, images });
			view = 'quote';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Analysis failed.';
		} finally {
			analyzing = false;
		}
	}

	/** Back to intake keeps meta/images/result untouched — nothing is lost. */
	function newIntake() {
		view = 'intake';
	}
</script>

<svelte:head>
	<title>Avante Probe Intake</title>
</svelte:head>

{#if view === 'intake'}
	<div
		class="view-intake"
		in:fly={{ y: -12, duration: transitionMs }}
		out:fade={{ duration: transitionMs }}
	>
		<section class="card intake-card">
			<div class="pane-hdr">
				<h1 class="eyebrow">Intake</h1>
			</div>
			<div class="pane-body">
				<IntakeForm bind:meta />
				<CapturePanel bind:images />
				<InspectionForm bind:images />

				{#if errorMessage}
					<p class="error-line" role="alert">{errorMessage}</p>
				{/if}

				<button type="button" class="btn btn-primary" disabled={analyzing} onclick={analyze}>
					{analyzing ? 'Analyzing…' : 'Analyze probe'}
				</button>
			</div>
		</section>
	</div>
{:else if result}
	<div
		class="view-quote"
		in:fly={{ y: 12, duration: transitionMs }}
		out:fade={{ duration: transitionMs }}
	>
		<div class="quote-toolbar">
			<button type="button" class="btn-back" onclick={newIntake}>← New intake</button>
			<!-- Export / Email land here — Task 15 wires them. -->
			<div class="quote-actions-placeholder"></div>
		</div>
		<section class="card quote-card">
			<div class="pane-hdr">
				<h1 class="eyebrow">Quote</h1>
			</div>
			<div class="pane-body">
				<ResultsView {result} />
			</div>
		</section>
	</div>
{/if}
