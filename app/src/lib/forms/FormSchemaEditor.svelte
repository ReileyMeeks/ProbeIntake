<script lang="ts">
	/*
	 * Edit a FormField[] in place. Reusable across the admin pages that
	 * design ticket forms (one per AppSource).
	 *
	 * UX:
	 *   • One row per field. Reorder via ↑ / ↓ buttons (no DnD lib).
	 *   • Per-row: type, label, field-key, required, options textarea (for
	 *     selects), optional parent-field selector + per-parent options
	 *     map (cascading / Model C).
	 *   • Live preview at the bottom using <DynamicForm> so admins see
	 *     exactly what /tickets/new will render.
	 *
	 * Cascading editor stores `optionsByParent` as text per row keyed by
	 * the parent's possible values — when a parent field changes
	 * options, child options get merged (new parent values get empty
	 * lists; removed parent values stay until manually pruned).
	 */
	import { GlassButton } from '$lib/glass';
	import { XIcon, PlusIcon, ChevronLeftIcon } from '$lib/icons';
	import DynamicForm from './DynamicForm.svelte';
	import { renderSubjectTemplate } from './renderSubjectTemplate';
	import type { FormField, FormFieldType, FormValues } from './types';
	import type { RemoteSiteIntegration } from '$lib/api/types';

	interface Props {
		fields: FormField[];
		subjectTemplate?: string;
		/** Source names for the dynamic-options source selector. When null/absent,
		 *  the source name is a free-text input (integration not yet configured). */
		remoteSiteIntegration?: RemoteSiteIntegration | null;
		/** Forwarded to DynamicForm so the live preview can actually fetch
		 *  dynamic-options while the admin is editing. */
		appSourceId?: string;
	}

	let {
		fields = $bindable(),
		subjectTemplate = $bindable(''),
		remoteSiteIntegration,
		appSourceId
	}: Props = $props();

	// Built-in field keys the dashboard's /tickets/new always shows
	// alongside the custom fields. Used by the live preview header and
	// surfaced as token-insert buttons next to the subject template.
	const BUILT_IN_KEYS = ['subject', 'description', 'priority'];

	const TYPES: { value: FormFieldType; label: string }[] = [
		{ value: 'text', label: 'Text' },
		{ value: 'textarea', label: 'Textarea' },
		{ value: 'number', label: 'Number' },
		{ value: 'select', label: 'Select (dropdown)' }
	];

	// Preview state mirrors what /tickets/new would render.
	let previewValues = $state<FormValues>({});

	function addField() {
		fields = [
			...fields,
			{
				field: `field${fields.length + 1}`,
				type: 'text',
				label: 'New field',
				required: false
			}
		];
	}

	function removeField(index: number) {
		fields = fields.filter((_, i) => i !== index);
		// Drop preview value to keep the runtime tidy.
		const removed = fields[index]?.field;
		if (removed && removed in previewValues) {
			const { [removed]: _, ...rest } = previewValues;
			previewValues = rest;
		}
	}

	function move(index: number, delta: -1 | 1) {
		const target = index + delta;
		if (target < 0 || target >= fields.length) return;
		const copy = [...fields];
		[copy[index], copy[target]] = [copy[target], copy[index]];
		fields = copy;
	}

	function setType(index: number, type: FormFieldType) {
		const updated = { ...fields[index], type };
		// Clear options / cascading / dynamic config when switching away from select.
		if (type !== 'select') {
			delete updated.options;
			delete updated.parentField;
			delete updated.optionsByParent;
			delete updated.dynamicOptions;
		}
		updateField(index, updated);
	}

	function setDynamicOptions(index: number, enabled: boolean) {
		const field = fields[index];
		if (enabled) {
			// Pick first configured source name, or leave empty for the admin to fill.
			const firstSource = Object.keys(remoteSiteIntegration?.sources ?? {})[0] ?? '';
			const { options, parentField, optionsByParent, ...rest } = field;
			updateField(index, { ...rest, dynamicOptions: { source: firstSource } });
		} else {
			const { dynamicOptions, ...rest } = field;
			updateField(index, rest);
		}
	}

	function updateField(index: number, next: FormField) {
		const copy = [...fields];
		copy[index] = next;
		fields = copy;
	}

	// ── Options helpers (a flat options list — non-cascading select) ──
	function optionsToText(opts: string[] | undefined): string {
		return (opts ?? []).join('\n');
	}
	function textToOptions(text: string): string[] {
		return text
			.split('\n')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	// ── Cascading helpers ─────────────────────────────────────────────
	//
	// `optionsByParent` maps parent-value → child-option-list. The editor
	// uses the parent field's `options` list to render one textarea per
	// parent value. When the parent's options change, this function
	// reconciles: new parent values get empty lists, dropped values stay
	// (so admin can prune manually).
	function parentOptionsOf(parentFieldKey: string | undefined): string[] {
		if (!parentFieldKey) return [];
		const parent = fields.find((f) => f.field === parentFieldKey);
		return parent?.options ?? [];
	}

	function reconcileOptionsByParent(
		current: Record<string, string[]> | undefined,
		parentValues: string[]
	): Record<string, string[]> {
		const next: Record<string, string[]> = { ...(current ?? {}) };
		for (const v of parentValues) {
			if (!(v in next)) next[v] = [];
		}
		return next;
	}
</script>

<div class="schema-editor">
	<!-- Subject template — sits at the top because it's the "shape of
	     the whole form's output" rather than a per-field concern. Token
	     buttons populate the textarea with the selected field's key. -->
	<div class="subject-section">
		<h3 class="editor-title">Subject template (optional)</h3>
		<p class="muted hint">
			When set, <code>/tickets/new</code> derives the subject from form
			values and built-in fields. Tokens look like
			<code>{`{{fieldKey}}`}</code>. Leave blank to let users type
			their own subject.
		</p>
		<textarea
			class="ed-input"
			rows="2"
			placeholder={'e.g. {{category}} issue at {{site}}'}
			bind:value={subjectTemplate}
		></textarea>
		<div class="token-buttons">
			<span class="muted token-label">Insert:</span>
			{#each BUILT_IN_KEYS as key (key)}
				<button
					type="button"
					class="token-btn focus-glass"
					onclick={() => (subjectTemplate += `{{${key}}}`)}
				>
					&#123;&#123;{key}&#125;&#125;
				</button>
			{/each}
			{#each fields as f (f.field)}
				{#if f.field}
					<button
						type="button"
						class="token-btn focus-glass"
						onclick={() => (subjectTemplate += `{{${f.field}}}`)}
					>
						&#123;&#123;{f.field}&#125;&#125;
					</button>
				{/if}
			{/each}
		</div>
	</div>

	<div class="editor-header">
		<h3 class="editor-title">Form fields</h3>
		<GlassButton
			onclick={addField}
			tone="primary"
			iconOnly
			size="md"
			title="Add field"
		>
			<PlusIcon size={14} />
			<span class="sr-only">Add field</span>
		</GlassButton>
	</div>

	{#if fields.length === 0}
		<p class="muted empty">No fields yet. Add one to start designing the ticket form.</p>
	{/if}

	{#each fields as field, i (field.field + i)}
		{@const eligibleGates = fields.filter(
			(f, fi) => f.type === 'select' && f.field !== field.field && fi !== i
		)}
		<div class="field-row">
			<header class="field-row-header">
				<div class="field-reorder">
					<button
						type="button"
						class="reorder-btn focus-glass"
						onclick={() => move(i, -1)}
						disabled={i === 0}
						title="Move up"
						aria-label="Move up"
					>
						<ChevronLeftIcon size={12} class="up" />
					</button>
					<button
						type="button"
						class="reorder-btn focus-glass"
						onclick={() => move(i, 1)}
						disabled={i === fields.length - 1}
						title="Move down"
						aria-label="Move down"
					>
						<ChevronLeftIcon size={12} class="down" />
					</button>
				</div>
				<span class="field-row-title">Field #{i + 1}</span>
				<button
					type="button"
					class="remove-btn focus-glass"
					onclick={() => removeField(i)}
					title="Remove field"
					aria-label="Remove field"
				>
					<XIcon size={12} />
				</button>
			</header>

			<div class="field-grid">
				<div class="cell">
					<label for="key-{i}">Field key</label>
					<input
						id="key-{i}"
						class="ed-input mono"
						value={field.field}
						oninput={(e) =>
							updateField(i, { ...field, field: (e.target as HTMLInputElement).value })}
						placeholder="e.g. deviceSerial"
					/>
				</div>
				<div class="cell">
					<label for="label-{i}">Label</label>
					<input
						id="label-{i}"
						class="ed-input"
						value={field.label ?? ''}
						oninput={(e) =>
							updateField(i, { ...field, label: (e.target as HTMLInputElement).value })}
						placeholder="What the user sees"
					/>
				</div>
				<div class="cell">
					<label for="type-{i}">Type</label>
					<select
						id="type-{i}"
						class="ed-input"
						value={field.type}
						onchange={(e) => setType(i, (e.target as HTMLSelectElement).value as FormFieldType)}
					>
						{#each TYPES as t (t.value)}
							<option value={t.value}>{t.label}</option>
						{/each}
					</select>
				</div>
				<div class="cell required-cell">
					<label class="required-row">
						<input
							type="checkbox"
							checked={field.required}
							onchange={(e) =>
								updateField(i, { ...field, required: (e.target as HTMLInputElement).checked })}
						/>
						<span>Required</span>
					</label>
				</div>
			</div>

			{#if field.type === 'select'}
				<!-- Toggle between static and dynamic (RemoteSite) options. Using
				     presence of `dynamicOptions` as the mode discriminator keeps
				     the schema clean — no extra flag that can drift out of sync. -->
				<div class="dynamic-mode-row">
					<label class="required-row">
						<input
							type="checkbox"
							checked={!!field.dynamicOptions}
							onchange={(e) => setDynamicOptions(i, (e.target as HTMLInputElement).checked)}
						/>
						<span>Fetch options from RemoteSite (dynamic)</span>
					</label>
				</div>

				{#if field.dynamicOptions}
					<!-- Dynamic options config: source name + optional dependsOn -->
					<div class="select-config">
						<div class="cell">
							<label for="src-{i}">RemoteSite source</label>
							{#if remoteSiteIntegration && Object.keys(remoteSiteIntegration.sources).length > 0}
								<select
									id="src-{i}"
									class="ed-input"
									value={field.dynamicOptions.source}
									onchange={(e) =>
										updateField(i, {
											...field,
											dynamicOptions: {
												...field.dynamicOptions!,
												source: (e.target as HTMLSelectElement).value
											}
										})}
								>
									{#each Object.keys(remoteSiteIntegration.sources) as src (src)}
										<option value={src}>{src}</option>
									{/each}
								</select>
							{:else}
								<input
									id="src-{i}"
									class="ed-input mono"
									value={field.dynamicOptions.source}
									oninput={(e) =>
										updateField(i, {
											...field,
											dynamicOptions: {
												...field.dynamicOptions!,
												source: (e.target as HTMLInputElement).value
											}
										})}
									placeholder="source-name"
								/>
								{#if !remoteSiteIntegration}
									<p class="muted hint inline-warn">
										No RemoteSite integration configured yet. Save will succeed, but
										the dropdown will show empty until the integration is set up.
									</p>
								{/if}
							{/if}
						</div>
						<div class="cell">
							<label for="dep-{i}">Depends on field (optional)</label>
							<select
								id="dep-{i}"
								class="ed-input"
								value={field.dynamicOptions.dependsOn ?? ''}
								onchange={(e) => {
									const next = (e.target as HTMLSelectElement).value;
									updateField(i, {
										...field,
										dynamicOptions: next
											? { source: field.dynamicOptions!.source, dependsOn: next }
											: { source: field.dynamicOptions!.source }
									});
								}}
							>
								<option value="">No dependency — always fetch</option>
								{#each fields as f, fi (f.field + fi)}
									{#if fi !== i && f.field}
										<option value={f.field}>{f.label ?? f.field} ({f.field})</option>
									{/if}
								{/each}
							</select>
							<p class="muted hint">
								When set, options are only fetched once this parent field has a value.
							</p>
						</div>
					</div>
				{:else}
					<!-- Static options config (flat list + optional cascading parent) -->
					<div class="select-config">
						<div class="cell">
							<label for="opts-{i}">Options (one per line)</label>
							<textarea
								id="opts-{i}"
								class="ed-input"
								rows="3"
								value={optionsToText(field.options)}
								oninput={(e) =>
									updateField(i, {
										...field,
										options: textToOptions((e.target as HTMLTextAreaElement).value)
									})}
								placeholder={'HVAC\nPlumbing\nElectrical'}
							></textarea>
						</div>

						<div class="cell">
							<label for="parent-{i}">Cascading parent (optional)</label>
							<select
								id="parent-{i}"
								class="ed-input"
								value={field.parentField ?? ''}
								onchange={(e) => {
									const next = (e.target as HTMLSelectElement).value;
									if (!next) {
										const { parentField, optionsByParent, ...rest } = field;
										updateField(i, rest);
									} else {
										const parentOpts = parentOptionsOf(next);
										updateField(i, {
											...field,
											parentField: next,
											optionsByParent: reconcileOptionsByParent(field.optionsByParent, parentOpts)
										});
									}
								}}
							>
								<option value="">No parent — flat list</option>
								{#each fields as f, fi (f.field + fi)}
									{#if f.type === 'select' && f.field !== field.field}
										<option value={f.field}>{f.label ?? f.field} ({f.field})</option>
									{/if}
								{/each}
							</select>
							<p class="muted hint">
								When a parent is selected, the child's options come from
								<code>optionsByParent[parentValue]</code> instead of the flat list above.
							</p>
						</div>

						{#if field.parentField}
							{@const parentOpts = parentOptionsOf(field.parentField)}
							{#if parentOpts.length === 0}
								<p class="muted hint inline-warn">
									Parent <code>{field.parentField}</code> has no options yet. Add options to the parent
									first.
								</p>
							{:else}
								<div class="cascade-grid">
									{#each parentOpts as parentValue (parentValue)}
										<div class="cell cascade-cell">
											<label for="cascade-{i}-{parentValue}">
												When <strong>{field.parentField}</strong> = <code>{parentValue}</code>
											</label>
											<textarea
												id="cascade-{i}-{parentValue}"
												class="ed-input"
												rows="3"
												value={optionsToText(field.optionsByParent?.[parentValue])}
												oninput={(e) => {
													const newOpts = textToOptions((e.target as HTMLTextAreaElement).value);
													const map = { ...(field.optionsByParent ?? {}) };
													map[parentValue] = newOpts;
													updateField(i, { ...field, optionsByParent: map });
												}}
												placeholder="Options for this parent value, one per line"
											></textarea>
										</div>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Show When (conditional visibility) — applies to all field
			     types. The gate field is any OTHER select in the schema
			     (showWhen against a free-text field doesn't make sense).
			     `eligibleGates` is declared at the top of this {#each}. -->
			{#if eligibleGates.length > 0}
				<div class="show-when-config">
					<div class="cell">
						<label for="when-{i}">Show this field only when…</label>
						<select
							id="when-{i}"
							class="ed-input"
							value={field.showWhen?.field ?? ''}
							onchange={(e) => {
								const next = (e.target as HTMLSelectElement).value;
								if (!next) {
									const { showWhen, ...rest } = field;
									updateField(i, rest);
								} else {
									updateField(i, {
										...field,
										showWhen: {
											field: next,
											equals:
												field.showWhen?.field === next ? field.showWhen.equals : []
										}
									});
								}
							}}
						>
							<option value="">Always show</option>
							{#each eligibleGates as f (f.field)}
								<option value={f.field}>{f.label ?? f.field} ({f.field})</option>
							{/each}
						</select>
					</div>

					{#if field.showWhen}
						{@const gateField = fields.find((f) => f.field === field.showWhen!.field)}
						{@const gateOptions = gateField?.options ?? []}
						{#if gateOptions.length === 0}
							<p class="muted hint inline-warn">
								Gate field <code>{field.showWhen.field}</code> has no options yet.
								Add options to it first.
							</p>
						{:else}
							<div class="cell">
								<span class="cell-label">…has one of these values:</span>
								<div class="checkbox-grid">
									{#each gateOptions as opt (opt)}
										<label class="check-label">
											<input
												type="checkbox"
												checked={field.showWhen.equals.includes(opt)}
												onchange={(e) => {
													const on = (e.target as HTMLInputElement).checked;
													const set = new Set(field.showWhen!.equals);
													if (on) set.add(opt);
													else set.delete(opt);
													updateField(i, {
														...field,
														showWhen: { ...field.showWhen!, equals: Array.from(set) }
													});
												}}
											/>
											<span>{opt}</span>
										</label>
									{/each}
								</div>
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	{/each}

	{#if fields.length > 0 || subjectTemplate}
		<div class="preview">
			<h3 class="preview-title">Live preview</h3>
			<p class="muted hint">
				Exactly what <code>/tickets/new</code> shows for this AppSource.
				Try filling it in — cascading + showWhen + the subject template
				should all react.
			</p>

			<!-- Built-in fields the production /tickets/new always renders.
			     Read-only stubs here so the admin sees the full form context
			     without being able to edit those slots from the schema editor. -->
			<div class="builtin-stubs" aria-label="Built-in fields">
				<div class="builtin-field">
					<span class="builtin-label">
						Subject
						{#if subjectTemplate}
							<span class="builtin-tag">auto from template</span>
						{:else}
							<span class="builtin-tag">user types</span>
						{/if}
					</span>
					{#if subjectTemplate}
						<div class="builtin-value">
							{renderSubjectTemplate(subjectTemplate, previewValues, {
								subject: '(user subject)',
								description: '(user description)',
								priority: 'medium'
							}) || '(template renders empty — fill the fields below)'}
						</div>
					{:else}
						<div class="builtin-value builtin-placeholder">
							(user types the subject)
						</div>
					{/if}
				</div>
				<div class="builtin-field">
					<span class="builtin-label">
						Description <span class="builtin-tag">user types</span>
					</span>
					<div class="builtin-value builtin-placeholder">(user types the description)</div>
				</div>
				<div class="builtin-field">
					<span class="builtin-label">
						Priority <span class="builtin-tag">user picks</span>
					</span>
					<div class="builtin-value builtin-placeholder">low · medium · high · critical</div>
				</div>
			</div>

			{#if fields.length > 0}
				<div class="preview-divider"></div>
				<DynamicForm {fields} bind:values={previewValues} {appSourceId} />
			{/if}
		</div>
	{/if}
</div>

<style>
	.schema-editor {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.editor-title,
	.preview-title {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-page-fg-muted);
		margin: 0;
	}
	.muted {
		color: var(--color-page-fg-muted);
	}
	.hint {
		font-size: 0.75rem;
	}
	.empty {
		font-size: 0.875rem;
		padding: 0.5rem 0;
	}

	.field-row {
		padding: 1rem;
		border-radius: 0.875rem;
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.field-row-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.field-row-title {
		flex: 1;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-page-fg-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.field-reorder {
		display: inline-flex;
		gap: 0.25rem;
	}
	.reorder-btn,
	.remove-btn {
		appearance: none;
		border: 1px solid var(--color-glass-border);
		background: var(--color-glass-tint);
		color: var(--color-page-fg-muted);
		width: 1.625rem;
		height: 1.625rem;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.reorder-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.reorder-btn:hover:not(:disabled),
	.remove-btn:hover {
		color: var(--color-page-fg);
		background: var(--color-glass-tint-strong);
	}
	.remove-btn {
		color: var(--color-priority-critical);
	}

	/* The ChevronLeftIcon points left. Use CSS rotation to repurpose it
	   as up / down arrows so we don't need three SVG variants. */
	.reorder-btn :global(.up) {
		transform: rotate(90deg);
	}
	.reorder-btn :global(.down) {
		transform: rotate(-90deg);
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem;
	}
	.cell {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
	}
	.cell label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-page-fg-muted);
	}
	/*
	 * Required cell — the other grid cells stack label+input over two
	 * rows, so the input baseline sits roughly 1.25rem below the cell's
	 * top edge. Pushing the checkbox down to match that baseline keeps
	 * the row visually aligned without needing matching column widths.
	 */
	.required-cell {
		justify-content: flex-start;
		padding-top: 1.5rem;
	}
	/*
	 * Required checkbox — uses the saturated tone-primary bg (same recipe
	 * as the +/✓ action buttons) so it pops in both themes. Bigger box +
	 * thicker border + a subtle shadow ring when checked so it reads
	 * "active" against a near-white card in light mode.
	 */
	.required-row {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
		user-select: none;
	}
	.required-row input[type='checkbox'] {
		appearance: none;
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 0.3125rem;
		border: 1.75px solid var(--color-page-fg-muted);
		background: transparent;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition:
			background-color 160ms var(--ease-glass),
			border-color 160ms var(--ease-glass),
			box-shadow 160ms var(--ease-glass);
	}
	.required-row input[type='checkbox']:hover {
		border-color: var(--color-page-fg);
	}
	.required-row input[type='checkbox']:checked {
		background: var(--color-tone-primary-bg);
		border-color: var(--color-tone-primary-bg);
		box-shadow:
			0 0 0 1px rgb(255 255 255 / 0.2),
			0 2px 6px color-mix(in srgb, var(--color-tone-primary-bg) 40%, transparent);
	}
	.required-row input[type='checkbox']:checked::after {
		content: '✓';
		color: var(--color-tone-primary-fg);
		font-size: 0.8125rem;
		font-weight: 800;
		line-height: 1;
	}

	/*
	 * Editor inputs use the same recipe as the Monday column mapping
	 * inputs (light glass tint + blur). Previously I had var(--color-page-bg)
	 * which read as black in dark mode and faint blue in light mode —
	 * neither matched neighboring controls.
	 */
	.ed-input {
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
	textarea.ed-input {
		border-radius: 0.75rem;
	}
	.ed-input:hover:not(:disabled) {
		border-color: var(--color-glass-border-bright);
	}
	.ed-input::placeholder {
		color: var(--color-page-fg-muted);
	}
	.ed-input.mono {
		font-family: 'SF Mono', Menlo, monospace;
	}

	.dynamic-mode-row {
		padding-top: 0.5rem;
		border-top: 1px dashed var(--color-glass-border);
	}

	.select-config {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-top: 0.625rem;
		border-top: 1px dashed var(--color-glass-border);
	}
	.cascade-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.625rem;
		background: color-mix(in srgb, var(--color-accent) 8%, transparent);
		border: 1px dashed color-mix(in srgb, var(--color-accent) 30%, transparent);
	}
	.cascade-cell label {
		font-size: 0.75rem;
		color: var(--color-page-fg);
	}
	.inline-warn {
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--color-priority-high) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-priority-high) 30%, transparent);
		color: var(--color-priority-high);
	}

	.preview {
		margin-top: 0.5rem;
		padding: 1.25rem;
		border-radius: 1rem;
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.preview-divider {
		height: 1px;
		background: var(--color-glass-border);
		margin: 0.5rem 0;
	}

	/* Subject template section — top of the editor, separated from the
	   field list by a soft visual break. Token buttons line up below
	   the textarea like @-mention chips. */
	.subject-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.875rem 1rem;
		border-radius: 0.875rem;
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
	}
	.token-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		align-items: center;
	}
	.token-label {
		font-size: 0.75rem;
		font-weight: 500;
	}
	.token-btn {
		appearance: none;
		border: 1px solid var(--color-glass-border);
		background: var(--color-glass-tint);
		color: var(--color-page-fg);
		font: inherit;
		font-family: 'SF Mono', Menlo, monospace;
		font-size: 0.75rem;
		padding: 0.25rem 0.5625rem;
		border-radius: 999px;
		cursor: pointer;
	}
	.token-btn:hover {
		background: var(--color-glass-tint-strong);
		border-color: var(--color-glass-border-bright);
	}

	/* Show-when (conditional visibility) — separated from select-config
	   by a dashed inset so the admin sees these as orthogonal concerns. */
	.show-when-config {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding-top: 0.625rem;
		border-top: 1px dashed var(--color-glass-border);
	}
	.cell-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-page-fg-muted);
	}
	.checkbox-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.4375rem 0.75rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--color-accent) 6%, transparent);
		border: 1px dashed color-mix(in srgb, var(--color-accent) 28%, transparent);
	}
	.check-label {
		display: inline-flex;
		align-items: center;
		gap: 0.4375rem;
		font-size: 0.8125rem;
		cursor: pointer;
		user-select: none;
	}
	.check-label input[type='checkbox'] {
		appearance: none;
		width: 1rem;
		height: 1rem;
		border-radius: 0.25rem;
		border: 1.5px solid var(--color-page-fg-muted);
		background: transparent;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.check-label input[type='checkbox']:checked {
		background: var(--color-tone-primary-bg);
		border-color: var(--color-tone-primary-bg);
	}
	.check-label input[type='checkbox']:checked::after {
		content: '✓';
		color: var(--color-tone-primary-fg);
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1;
	}

	/* Built-in field stubs in the preview — read-only ghosts that show
	   the admin what the production /tickets/new form actually renders. */
	.builtin-stubs {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.builtin-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.builtin-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-page-fg-muted);
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.builtin-tag {
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-page-fg-muted);
		padding: 0.0625rem 0.375rem;
		border-radius: 0.25rem;
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
	}
	.builtin-value {
		padding: 0.4375rem 0.75rem;
		font-size: 0.875rem;
		color: var(--color-page-fg);
		background: var(--color-glass-tint);
		border: 1px dashed var(--color-glass-border);
		border-radius: 0.5rem;
		font-weight: 500;
	}
	.builtin-placeholder {
		color: var(--color-page-fg-muted);
		font-weight: 400;
		font-style: italic;
	}

	code {
		font-family: 'SF Mono', Menlo, monospace;
		font-size: 0.8125rem;
		padding: 0.0625rem 0.25rem;
		border-radius: 4px;
		background: var(--color-glass-tint);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
