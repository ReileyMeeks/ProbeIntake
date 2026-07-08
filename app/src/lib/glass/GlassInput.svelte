<script lang="ts">
	interface Props {
		value: string;
		type?: 'text' | 'email' | 'number' | 'search' | 'url';
		placeholder?: string;
		required?: boolean;
		disabled?: boolean;
		id?: string;
		name?: string;
		'aria-label'?: string;
		'aria-describedby'?: string;
		class?: string;
		oninput?: (e: Event) => void;
		onchange?: (e: Event) => void;
	}

	let {
		value = $bindable(),
		type = 'text',
		placeholder,
		required = false,
		disabled = false,
		id,
		name,
		'aria-label': ariaLabel,
		'aria-describedby': ariaDescribedBy,
		class: extraClass = '',
		oninput,
		onchange
	}: Props = $props();

	// Inputs deliberately skip the highlight gradient + refraction — the
	// design contract calls these out as anti-patterns inside form fields
	// because the displacement makes typed text shimmer.
</script>

<input
	{id}
	{name}
	{type}
	{placeholder}
	{required}
	{disabled}
	aria-label={ariaLabel}
	aria-describedby={ariaDescribedBy}
	bind:value
	{oninput}
	{onchange}
	class="glass-input focus-glass {extraClass}"
/>

<style>
	.glass-input {
		display: block;
		width: 100%;
		padding: 0.625rem 0.875rem;
		font: inherit;
		color: var(--color-page-fg);
		background: var(--color-glass-tint);
		/* Theme-relative edge (mixes toward the foreground color) instead of
		   the fixed near-white --color-glass-border — that border is nearly
		   invisible against a light-mode card since white-on-near-white has
		   almost no contrast. */
		border: 1px solid color-mix(in srgb, var(--color-page-fg) 24%, transparent);
		border-radius: 999px;
		backdrop-filter: blur(12px) saturate(160%);
		-webkit-backdrop-filter: blur(12px) saturate(160%);
		/* Without a shadow the field reads flush with the page — this lifts
		   it just enough to look like a recessed/raised control rather than
		   a flat rectangle, especially on the light paper background. */
		box-shadow: var(--shadow-glass-sm);
		transition:
			border-color 160ms var(--ease-glass),
			background-color 160ms var(--ease-glass),
			box-shadow 160ms var(--ease-glass);
	}
	.glass-input::placeholder {
		color: var(--color-page-fg-muted);
	}
	.glass-input:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--color-page-fg) 38%, transparent);
	}
	.glass-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	@media (prefers-reduced-transparency: reduce) {
		.glass-input {
			background: var(--color-page-bg);
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}
	}
</style>
