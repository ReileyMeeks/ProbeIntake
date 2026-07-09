<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';

	let { children } = $props();

	/**
	 * Workflow steps, ported from the HTML mockup's `.wfbar` (lines ~237-251).
	 * Step activation will be wired to real app state once the intake flow
	 * (Task 13+) exists; for now step 1 is active, matching the mockup.
	 */
	const WORKFLOW_STEPS = [
		'Capture images',
		'Electrical & functional',
		'Photograph form',
		'AI analysis',
		'Download PDFs',
		'Send to AUE Lab',
		'Coordinator ERP'
	];

	let activeStep = $state(0);

	// The login page is unauthenticated and shouldn't show app chrome that
	// implies an in-progress intake (the navy header + workflow bar).
	const showChrome = $derived(page.url.pathname !== '/login');
</script>

<svelte:head>
	<title>Avante Probe Intake</title>
</svelte:head>

{#if showChrome}
	<header class="hdr">
		<div class="hdr-brand">
			<div class="hdr-logo">
				<img src="/logo.png" alt="Avante Health Solutions" />
			</div>
			<div>
				<div class="hdr-name">Avante Health Solutions</div>
				<div class="hdr-sub">Probe Intake &amp; AI Quote</div>
			</div>
		</div>
		<div class="hdr-right">
			<div class="hdr-status ready">
				<div class="hdot green"></div>
				<span>Ready</span>
			</div>
		</div>
	</header>

	<div class="wfbar" aria-label="Intake workflow progress">
		{#each WORKFLOW_STEPS as step, i (step)}
			<div class="wf" class:active={i === activeStep} class:done={i < activeStep}>
				<div class="wfn">{i + 1}</div>
				{step}
			</div>
			{#if i < WORKFLOW_STEPS.length - 1}
				<div class="warr">&rsaquo;</div>
			{/if}
		{/each}
	</div>
{/if}

{@render children()}
