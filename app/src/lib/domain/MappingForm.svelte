<script lang="ts">
	import GlassCard from '$lib/glass/GlassCard.svelte';

	let {
		headers,
		fields,
		mapping = $bindable<Record<string, string>>({}),
		title
	}: {
		headers: string[];
		fields: { key: string; label: string }[];
		mapping?: Record<string, string>;
		title: string;
	} = $props();

	function bestMatch(field: string): string {
		const lower = field.toLowerCase().replace(/_/g, ' ');
		const exact = headers.find((h) => h.toLowerCase() === lower);
		if (exact) return exact;
		const contains = headers.find(
			(h) => h.toLowerCase().includes(lower) || lower.includes(h.toLowerCase())
		);
		return contains ?? '';
	}

	$effect(() => {
		for (const f of fields) {
			if (!mapping[f.key]) mapping[f.key] = bestMatch(f.key);
		}
	});

	const missing = $derived(fields.filter((f) => !mapping[f.key]).map((f) => f.label));
</script>

<GlassCard flat>
	<div class="card-pad">
		<h3 class="section-title">{title}</h3>
		<div class="grid">
			{#each fields as f}
				<label class="field">
					<span class="field-label">{f.label}</span>
					<select class="glass-field" bind:value={mapping[f.key]}>
						<option value="">— select column —</option>
						{#each headers as h}<option value={h}>{h}</option>{/each}
					</select>
				</label>
			{/each}
		</div>
		{#if missing.length}
			<div class="warn-card">Missing: {missing.join(', ')}</div>
		{/if}
	</div>
</GlassCard>

<style>
	.card-pad {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.section-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.75rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.field-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-page-fg-muted);
	}
	.glass-field {
		display: block;
		width: 100%;
		padding: 0.625rem 0.875rem;
		padding-right: 2rem;
		font: inherit;
		color: var(--color-page-fg);
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
		border-radius: 999px;
		backdrop-filter: blur(12px) saturate(160%);
		-webkit-backdrop-filter: blur(12px) saturate(160%);
		transition: border-color 160ms var(--ease-glass);
		appearance: none;
		background-image:
			linear-gradient(135deg, var(--color-page-fg-muted) 50%, transparent 50%),
			linear-gradient(225deg, var(--color-page-fg-muted) 50%, transparent 50%);
		background-position:
			right 0.875rem top 55%,
			right 0.5rem top 55%;
		background-size: 0.375rem 0.375rem;
		background-repeat: no-repeat;
	}
	.glass-field:hover {
		border-color: var(--color-glass-border-bright);
	}
	.warn-card {
		background: color-mix(in srgb, var(--color-priority-high) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-priority-high) 30%, transparent);
		border-radius: 0.625rem;
		padding: 0.625rem 0.875rem;
		font-size: 0.8125rem;
		color: var(--color-priority-high);
	}

	@media (max-width: 480px) {
		.card-pad {
			padding: 1rem;
		}
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
