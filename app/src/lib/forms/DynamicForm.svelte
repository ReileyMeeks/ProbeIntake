<script lang="ts">
	import type { DynamicOption } from '$lib/api/types';
	import { appSources } from '$lib/api/client';
	import type { FormField, FormValues } from './types';
	import { resolveDependentOptions } from './resolveDependentOptions';
	import { shouldRender } from './shouldRender';

	let {
		fields,
		values = $bindable({}),
		appSourceId
	}: {
		fields: FormField[];
		values?: FormValues;
		/** When set, fields with `dynamicOptions` fetch their options from
		 *  the configured RemoteSite source. When unset (preview / editor),
		 *  dynamic-options fields render with an empty disabled dropdown
		 *  labeled "— preview only —". */
		appSourceId?: string;
	} = $props();

	// Per-field resolved option set. `null` = unconstrained (use field.options or
	// free input); `string[]` = constrained set (possibly empty when parent is
	// unset or maps to nothing).
	const resolvedOptions = $derived(
		fields.map((field) => resolveDependentOptions(field, values))
	);

	// Per-field visibility. Fields whose `showWhen` gate fails are not
	// rendered. This is also what the Vapor validator uses to skip
	// required checks — keep the JS and Swift implementations in sync.
	const visibility = $derived(
		fields.map((field) => shouldRender(field, values))
	);

	// Cache of dynamic-options results, keyed by `${fieldKey}|${parentValue}`.
	// Keyed by parent value so flipping `customer` from A → B → A reuses the
	// earlier A response without a re-fetch. Cleared per AppSource change.
	let dynamicCache = $state<Record<string, DynamicOption[]>>({});
	let dynamicLoading = $state<Record<string, boolean>>({});

	function dynamicCacheKey(field: FormField, parentValue: string): string {
		return `${field.field}|${parentValue}`;
	}

	// Fetch on demand: whenever a visible dynamic-options field's
	// dependsOn parent has a non-empty value (or there's no dependsOn),
	// fetch if we don't already have a cached result.
	$effect(() => {
		if (!appSourceId) return;
		fields.forEach((field, i) => {
			if (!visibility[i]) return;
			const d = field.dynamicOptions;
			if (!d) return;
			const parentValue = d.dependsOn ? String(values[d.dependsOn] ?? '') : '';
			if (d.dependsOn && !parentValue) return;
			const key = dynamicCacheKey(field, parentValue);
			if (dynamicCache[key] !== undefined || dynamicLoading[key]) return;
			dynamicLoading = { ...dynamicLoading, [key]: true };
			const context: Record<string, string> = {};
			if (d.dependsOn) context[d.dependsOn] = parentValue;
			const id = appSourceId;
			appSources
				.dynamicOptions(id, d.source, context)
				.then((opts) => {
					dynamicCache = { ...dynamicCache, [key]: opts };
				})
				.catch(() => {
					// Treat as empty so the field stays disabled; the user can
					// still pick a parent again to retry.
					dynamicCache = { ...dynamicCache, [key]: [] };
				})
				.finally(() => {
					dynamicLoading = { ...dynamicLoading, [key]: false };
				});
		});
	});

	function dynamicEntries(field: FormField, parentValue: string): DynamicOption[] | null {
		const d = field.dynamicOptions;
		if (!d) return null;
		const key = dynamicCacheKey(field, parentValue);
		return dynamicCache[key] ?? null;
	}

	// Clear-on-invalid + clear-on-hide: when a parent value changes such
	// that a child's current value is no longer in the resolved option set
	// (cascading), or when a field becomes hidden (showWhen), blank the
	// stored value. The blank propagates to descendants on the next tick.
	$effect(() => {
		fields.forEach((field, i) => {
			const current = values[field.field];
			if (!current) return;

			// Hidden field — clear regardless of allowed-options state.
			if (!visibility[i]) {
				values = { ...values, [field.field]: '' };
				return;
			}

			// Dynamic-options field: validate `current` against the cached
			// option set when it's loaded. While loading, leave the value
			// alone — clearing here would race with the fetch.
			const d = field.dynamicOptions;
			if (d) {
				const parentValue = d.dependsOn ? String(values[d.dependsOn] ?? '') : '';
				const entries = dynamicEntries(field, parentValue);
				if (entries !== null && !entries.some((e) => e.id === current)) {
					values = { ...values, [field.field]: '' };
				}
				return;
			}

			const allowed = resolvedOptions[i] ?? field.options ?? null;
			if (allowed === null) return;
			if (!allowed.includes(String(current))) {
				values = { ...values, [field.field]: '' };
			}
		});
	});

	function effectiveOptions(
		field: FormField,
		resolved: string[] | null
	): { id: string; label: string }[] {
		// Dynamic-options field — pull from cache (or empty during load).
		if (field.dynamicOptions) {
			const parentValue = field.dynamicOptions.dependsOn
				? String(values[field.dynamicOptions.dependsOn] ?? '')
				: '';
			const entries = dynamicEntries(field, parentValue);
			return entries ?? [];
		}
		const list = resolved ?? field.options ?? [];
		return list.map((v) => ({ id: v, label: v }));
	}

	function isDisabled(field: FormField, resolved: string[] | null): boolean {
		// Dynamic-options branch:
		//   • In editor preview (no appSourceId): always disabled.
		//   • dependsOn parent unset: disabled.
		//   • Fetch in flight: disabled.
		if (field.dynamicOptions) {
			if (!appSourceId) return true;
			const d = field.dynamicOptions;
			const parentValue = d.dependsOn ? String(values[d.dependsOn] ?? '') : '';
			if (d.dependsOn && !parentValue) return true;
			const key = dynamicCacheKey(field, parentValue);
			return dynamicLoading[key] === true;
		}
		// Static-cascading branch — disabled when parent unset.
		return field.parentField !== undefined && resolved !== null && resolved.length === 0;
	}

	function selectPlaceholder(field: FormField): string {
		if (field.dynamicOptions) {
			if (!appSourceId) return '— preview only —';
			const d = field.dynamicOptions;
			const parentValue = d.dependsOn ? String(values[d.dependsOn] ?? '') : '';
			if (d.dependsOn && !parentValue) return `— select ${d.dependsOn} first —`;
			const key = dynamicCacheKey(field, parentValue);
			if (dynamicLoading[key]) return '— loading —';
			return '— choose —';
		}
		if (field.parentField && (resolvedOptions[fields.indexOf(field)] ?? []).length === 0) {
			return '— select parent first —';
		}
		return '— choose —';
	}
</script>

<div class="dynamic-form">
	{#each fields as field, i (field.field)}
		{#if visibility[i]}
			{@const resolved = resolvedOptions[i]}
			{@const options = effectiveOptions(field, resolved)}
			{@const disabled = isDisabled(field, resolved)}
		<label class="dynamic-form__field">
			<span class="dynamic-form__label">
				{field.label ?? field.field}
				{#if field.required}<span class="dynamic-form__required" aria-hidden="true">*</span>{/if}
			</span>

			{#if field.type === 'select'}
				<select
					bind:value={values[field.field]}
					required={field.required}
					{disabled}
					aria-required={field.required}
				>
					<option value="">{selectPlaceholder(field)}</option>
					{#each options as opt (opt.id)}
						<option value={opt.id}>{opt.label}</option>
					{/each}
				</select>
			{:else if field.type === 'textarea'}
				<textarea
					bind:value={values[field.field]}
					required={field.required}
					aria-required={field.required}
					rows="4"
				></textarea>
			{:else if field.type === 'number'}
				<input
					type="number"
					bind:value={values[field.field]}
					required={field.required}
					aria-required={field.required}
				/>
			{:else}
				<input
					type="text"
					bind:value={values[field.field]}
					required={field.required}
					aria-required={field.required}
				/>
			{/if}
		</label>
		{/if}
	{/each}
</div>

<style>
	.dynamic-form {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}
	.dynamic-form__field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.dynamic-form__label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-page-fg-muted);
	}
	.dynamic-form__required {
		color: var(--color-priority-critical);
		margin-left: 0.25rem;
	}

	/*
	 * Inputs use the same glass-tint recipe as the rest of the app so the
	 * live preview (and the production form rendered at /tickets/new)
	 * read clearly in both light and dark mode. Tailwind's @forms plugin
	 * applies a base white background by default; this override wins by
	 * specificity (scope hash + class selector).
	 */
	.dynamic-form__field :global(input),
	.dynamic-form__field :global(select),
	.dynamic-form__field :global(textarea) {
		display: block;
		width: 100%;
		padding: 0.5rem 0.75rem;
		font: inherit;
		font-size: 0.875rem;
		color: var(--color-page-fg);
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
		border-radius: 999px;
		backdrop-filter: blur(12px) saturate(160%);
		-webkit-backdrop-filter: blur(12px) saturate(160%);
		appearance: none;
		transition: border-color 160ms var(--ease-glass);
	}
	.dynamic-form__field :global(input):hover:not(:disabled),
	.dynamic-form__field :global(select):hover:not(:disabled),
	.dynamic-form__field :global(textarea):hover:not(:disabled) {
		border-color: var(--color-glass-border-bright);
	}
	.dynamic-form__field :global(input::placeholder),
	.dynamic-form__field :global(textarea::placeholder) {
		color: var(--color-page-fg-muted);
	}
	.dynamic-form__field :global(input:focus-visible),
	.dynamic-form__field :global(select:focus-visible),
	.dynamic-form__field :global(textarea:focus-visible) {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.dynamic-form__field :global(textarea) {
		resize: vertical;
		min-height: 4.5rem;
		border-radius: 0.75rem;
	}
	.dynamic-form__field :global(select) {
		padding-right: 2rem;
		background-image:
			linear-gradient(45deg, transparent 50%, currentColor 50%),
			linear-gradient(135deg, currentColor 50%, transparent 50%);
		background-position:
			right 0.875rem top 55%,
			right 0.5rem top 55%;
		background-size:
			0.375rem 0.375rem,
			0.375rem 0.375rem;
		background-repeat: no-repeat;
		cursor: pointer;
	}
	.dynamic-form__field :global(select:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
