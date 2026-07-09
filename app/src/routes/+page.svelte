<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import type { AnalyzeResult, CapturedImage, ProbeMeta } from '$lib/domain/probe';
	import { postAnalyze, postEmail } from '$lib/api/client';
	import { intakeStatus } from '$lib/domain/status.svelte';
	import { buildReportPdf, pdfBase64 } from '$lib/ui/report';
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

	// ── Export / Email (Task 15) ─────────────────────────────────────────

	let emailTo = $state('');
	let emailSending = $state(false);
	let emailStatus = $state<'idle' | 'sent' | 'error'>('idle');
	let emailError = $state('');

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const isValidEmail = $derived(EMAIL_RE.test(emailTo.trim()));

	/** `probe-report-<model or WO#>.pdf`, sanitized for use as a filename. */
	function reportFileName(r: AnalyzeResult): string {
		const ident = r.probeId.model || meta.so || 'report';
		return `probe-report-${ident.replace(/[^a-zA-Z0-9-]+/g, '_')}.pdf`;
	}

	/** `Probe report — <model> <WO#/SO>` — the default email subject. */
	function reportSubject(r: AnalyzeResult): string {
		const model = r.probeId.model ?? meta.model ?? 'Unknown';
		return meta.so ? `Probe report — ${model} ${meta.so}` : `Probe report — ${model}`;
	}

	/** Short plain-text digest of findings + quote, sent alongside the PDF attachment. */
	function reportSummary(r: AnalyzeResult): string {
		const lines = [
			`Probe: ${r.probeId.model ?? '—'}${r.probeId.sn ? ' · S/N ' + r.probeId.sn : ''}`,
			meta.so ? `WO#: ${meta.so}` : '',
			'',
			'Findings:',
			...(r.findings.length
				? r.findings.map((f) => `- [${f.severity}] ${f.zone}: ${f.description}`)
				: ['- None']),
			'',
			'Repair quote:',
			...(r.quoteItems.length
				? r.quoteItems.map((q) => `- [${q.priority}] ${q.item} — ${q.rationale}`)
				: ['- None']),
			'',
			`Overall condition: ${r.overallCondition} (confidence ${r.confidence}%)`
		];
		return lines.filter((l) => l !== '').join('\n');
	}

	function exportPdf() {
		if (!result) return;
		buildReportPdf(result, meta, images).save(reportFileName(result));
	}

	function resetEmailStatus() {
		emailStatus = 'idle';
		emailError = '';
	}

	async function sendEmailReport() {
		if (!result || !isValidEmail || emailSending) return;
		emailSending = true;
		emailStatus = 'idle';
		emailError = '';
		try {
			const doc = buildReportPdf(result, meta, images);
			await postEmail({
				to: emailTo.trim(),
				subject: reportSubject(result),
				summary: reportSummary(result),
				pdfBase64: pdfBase64(doc)
			});
			emailStatus = 'sent';
		} catch (err) {
			emailStatus = 'error';
			emailError = err instanceof Error ? err.message : 'Email failed — try again.';
		} finally {
			emailSending = false;
		}
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
			<div class="quote-actions">
				{#if emailStatus === 'sent'}
					<span class="action-status sent">Sent</span>
				{:else if emailStatus === 'error'}
					<span class="action-status error" role="alert">{emailError}</span>
				{/if}
				<input
					class="inp email-input"
					type="email"
					placeholder="recipient@example.com"
					aria-label="Recipient email"
					bind:value={emailTo}
					oninput={resetEmailStatus}
				/>
				<button
					type="button"
					class="btn-back"
					disabled={!isValidEmail || emailSending}
					onclick={sendEmailReport}
				>
					{emailSending ? 'Sending…' : 'Email report'}
				</button>
				<button type="button" class="btn-back" onclick={exportPdf}>Export PDF</button>
			</div>
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
