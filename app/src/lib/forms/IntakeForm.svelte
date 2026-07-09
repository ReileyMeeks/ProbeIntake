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

	let { meta = $bindable<ProbeMeta>({}) }: { meta?: ProbeMeta } = $props();
</script>

<div class="card">
	<div class="card-hdr">
		<div class="card-icon" style="background:#eff6ff;color:var(--accent)">🔖</div>
		<div>
			<div class="card-title">Probe identification</div>
			<div class="card-sub">From label on probe body</div>
		</div>
	</div>
	<div class="card-body">
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
</div>

<style>
	.card {
		background: var(--s2);
		border: 1px solid var(--b1);
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}
	.card-hdr {
		padding: 11px 14px 10px;
		border-bottom: 1px solid var(--b1);
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.card-icon {
		width: 26px;
		height: 26px;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-size: 13px;
	}
	.card-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--t1);
	}
	.card-sub {
		font-size: 10px;
		color: var(--t4);
		margin-top: 1px;
	}
	.card-body {
		padding: 13px;
	}
	.field-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.field-wide {
		grid-column: 1 / -1;
	}
	.label {
		font-size: 9px;
		font-weight: 700;
		color: var(--t3);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.inp {
		width: 100%;
		height: 30px;
		padding: 0 9px;
		border: 1px solid var(--b2);
		border-radius: 7px;
		font-size: 11px;
		color: var(--t1);
		background: var(--s2);
		outline: none;
		font-family: inherit;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}
	.inp:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}
	.inp::placeholder {
		color: var(--t4);
	}
	textarea.inp {
		height: auto;
		padding: 7px 9px;
		resize: vertical;
		min-height: 52px;
	}
</style>
