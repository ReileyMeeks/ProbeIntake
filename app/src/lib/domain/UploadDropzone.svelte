<script lang="ts">
	let {
		label,
		accept = '.csv',
		file = $bindable<File | null>(null)
	}: { label: string; accept?: string; file?: File | null } = $props();

	let inputEl: HTMLInputElement | undefined = $state();
	let dragging = $state(false);

	function onPick(e: Event) {
		const t = e.target as HTMLInputElement;
		file = t.files?.[0] ?? null;
	}
	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		file = e.dataTransfer?.files?.[0] ?? null;
	}
	function clear() {
		file = null;
		if (inputEl) inputEl.value = '';
	}
</script>

<div
	class="zone"
	class:dragging
	role="button"
	tabindex="0"
	ondragover={(e) => {
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => {
		dragging = false;
	}}
	ondrop={onDrop}
	onclick={() => inputEl?.click()}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') inputEl?.click();
	}}
>
	<input bind:this={inputEl} type="file" {accept} onchange={onPick} class="sr-only" />

	{#if file}
		<div class="file-info">
			<span class="file-name">{file.name}</span>
			<span class="file-size">{Math.round(file.size / 1024)} KB</span>
			<button
				type="button"
				class="remove-btn focus-glass"
				onclick={(e) => {
					e.stopPropagation();
					clear();
				}}
				aria-label="Remove file">×</button
			>
		</div>
	{:else}
		<p class="zone-label">{label}</p>
		<p class="zone-hint">Drop a file here or <span class="zone-link">browse</span></p>
	{/if}
</div>

<style>
	.zone {
		border: 2px dashed var(--color-glass-border);
		border-radius: 0.75rem;
		padding: 1.5rem;
		text-align: center;
		cursor: pointer;
		transition:
			border-color 160ms var(--ease-glass),
			background-color 160ms var(--ease-glass);
	}
	.zone:hover,
	.zone.dragging {
		border-color: var(--color-glass-border-bright);
		background: var(--color-glass-tint);
	}
	.zone-label {
		font-size: 0.875rem;
		font-weight: 500;
		margin: 0 0 0.375rem;
	}
	.zone-hint {
		font-size: 0.8125rem;
		color: var(--color-page-fg-muted);
		margin: 0;
	}
	.zone-link {
		color: var(--color-tone-primary-bg);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.file-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.625rem;
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
		border-radius: 999px;
		font-size: 0.8125rem;
	}
	.file-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}
	.file-size {
		color: var(--color-page-fg-muted);
		font-size: 0.75rem;
		flex-shrink: 0;
	}
	.remove-btn {
		appearance: none;
		border: 0;
		background: transparent;
		color: var(--color-page-fg-muted);
		font: inherit;
		font-size: 1rem;
		line-height: 1;
		width: 1.375rem;
		height: 1.375rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		cursor: pointer;
		flex-shrink: 0;
	}
	.remove-btn:hover {
		color: var(--color-page-fg);
		background: var(--color-glass-tint-strong);
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
