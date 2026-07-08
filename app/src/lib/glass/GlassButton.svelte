<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** "default" = subtle glass tint; "prominent" = stronger tint + accent text. */
		variant?: 'default' | 'prominent';
		/**
		 * Color tint applied to the glass background:
		 *   • "neutral" (default) — uncolored glass.
		 *   • "primary"           — glassy blue, for new/save actions.
		 *   • "destructive"       — glassy red, for cancel/close actions.
		 * Tone tints overlay the existing glass tint at low opacity so the
		 * blur stays intact.
		 */
		tone?: 'neutral' | 'primary' | 'destructive';
		/** Icon-only buttons get square padding so the icon centers without label-tracking awkwardness. */
		iconOnly?: boolean;
		/** "sm" | "md" (default) | "lg" — padding scale. */
		size?: 'sm' | 'md' | 'lg';
		/** When set, renders as <a href> instead of <button> — same visual. */
		href?: string;
		/** Marks the link as the current page (only meaningful with href). */
		current?: boolean;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		title?: string;
		onclick?: (event: MouseEvent) => void;
		class?: string;
		children: Snippet;
	}

	let {
		variant = 'default',
		tone = 'neutral',
		iconOnly = false,
		size = 'md',
		href,
		current = false,
		type = 'button',
		disabled = false,
		title,
		onclick,
		class: extraClass = '',
		children
	}: Props = $props();

	// Buttons stay at L1+L2 only (no refraction). The design contract calls
	// for L3 on dialogs and cards, not on small interactive elements where
	// distortion would make labels jitter.

	const sizeClass = $derived.by(() => {
		if (iconOnly) {
			return size === 'sm'
				? 'btn-icon-sm'
				: size === 'lg'
					? 'btn-icon-lg'
					: 'btn-icon-md';
		}
		return size === 'sm'
			? 'px-3 py-1.5 text-sm'
			: size === 'lg'
				? 'px-6 py-3 text-base'
				: 'px-4 py-2 text-sm';
	});

	// Treat a current/active link the same as the prominent variant so the
	// nav uses the same visual language as primary action buttons.
	const isStrong = $derived(variant === 'prominent' || current);
	const toneClass = $derived(tone === 'neutral' ? '' : `tone-${tone}`);
	// Definition edge (iOS 27 Liquid Glass refinement) — only on untinted
	// buttons; the colored tone-* beads have their own halo.
	const edgeClass = $derived(tone === 'neutral' ? 'glass-edge-sides' : '');
</script>

{#if href}
	<a
		{href}
		{title}
		{onclick}
		aria-current={current ? 'page' : undefined}
		class="glass glass-press focus-glass {isStrong
			? 'glass-strong glass-prominent'
			: ''} {toneClass} {edgeClass} {sizeClass} {extraClass}"
	>
		{@render children()}
	</a>
{:else}
	<button
		{type}
		{title}
		{onclick}
		{disabled}
		class="glass glass-press focus-glass {isStrong
			? 'glass-strong glass-prominent'
			: ''} {toneClass} {edgeClass} {sizeClass} {extraClass}"
	>
		{@render children()}
	</button>
{/if}

<style>
	button,
	a {
		appearance: none;
		font: inherit;
		font-weight: 500;
		color: inherit;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border-radius: 999px;
		cursor: pointer;
		white-space: nowrap;
		text-decoration: none;
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	/* Prominent variant tints text toward the accent so it reads as primary. */
	.glass-prominent {
		color: var(--color-accent);
	}

	/* Icon-only sizes — square padding so the icon centers cleanly. */
	.btn-icon-sm {
		padding: 0.4375rem;
		min-width: 2rem;
		min-height: 2rem;
	}
	.btn-icon-md {
		padding: 0.5625rem;
		min-width: 2.375rem;
		min-height: 2.375rem;
	}
	.btn-icon-lg {
		padding: 0.75rem;
		min-width: 2.75rem;
		min-height: 2.75rem;
	}

	/* Tone-primary / tone-destructive styles live in global layout.css —
	   they need to override .glass's ::before pseudo-element which is
	   defined globally, and Svelte's scoped pseudo-element rules don't
	   reliably win that cascade. Keep them in one place. */
</style>
