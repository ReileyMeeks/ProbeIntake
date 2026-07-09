<script lang="ts">
	import type { ProbeMeta } from '$lib/domain/probe';

	/** Ported from the HTML mockup's `#f-*` fields (lines ~264-270). */
	const FIELDS: { key: string; label: string; placeholder: string }[] = [
		{ key: 'model', label: 'Model', placeholder: 'e.g. GE C1-6-D' },
		{ key: 'sn', label: 'Serial number', placeholder: 'e.g. 250840YP6' },
		{ key: 'ref', label: 'REF / part no.', placeholder: 'e.g. 5418916' },
		{ key: 'mfg', label: 'Mfg. date', placeholder: 'e.g. 2017-06' },
		{ key: 'so', label: 'Sales order / SO#', placeholder: 'SO number — used in email subject' },
		{ key: 'customer', label: 'Customer', placeholder: 'Customer name' }
	];

	let {
		meta = $bindable<ProbeMeta>({}),
		formStatus = 'idle'
	}: { meta?: ProbeMeta; formStatus?: 'idle' | 'pending' | 'done' } = $props();
</script>

<div class="identification">
	<div class="id-hdr">
		<h2 class="eyebrow">Probe identification</h2>
		{#if formStatus === 'pending'}
			<span class="form-status mono">Reading form…</span>
		{:else if formStatus === 'done'}
			<span class="form-status mono">Prefilled from form — review</span>
		{/if}
	</div>
	<div class="field-grid">
		{#each FIELDS as f (f.key)}
			<div class="field">
				<label class="label" for="f-{f.key}">{f.label}</label>
				<input class="inp" id="f-{f.key}" placeholder={f.placeholder} bind:value={meta[f.key]} />
			</div>
		{/each}
		<div class="field field-wide">
			<label class="label" for="f-notes">Tech notes</label>
			<textarea
				class="inp"
				id="f-notes"
				placeholder="Customer complaint, additional observations..."
				bind:value={meta.notes}
			></textarea>
		</div>
	</div>
</div>

<style>
	.identification {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.id-hdr {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}

	.form-status {
		font-size: 11px;
		color: var(--ink-3);
	}
</style>
