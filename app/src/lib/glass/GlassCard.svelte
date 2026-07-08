<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { supportsBackdropSvgFilter } from './featureDetect';

	interface Props {
		/** Optional click handler — when set, the card renders as a button. */
		onclick?: (event: MouseEvent) => void;
		/** Extra class for layout (padding, width, etc.) */
		class?: string;
		/** Render the strong-tint variant — used for focused / "primary" surfaces. */
		strong?: boolean;
		/** Suppress L3 refraction (shorthand for refraction="none"). Useful for cards containing inputs. */
		flat?: boolean;
		/**
		 * Use a mostly-opaque background — for content-heavy cards (ticket
		 * detail, status pickers, message thread). Glass edges stay; the
		 * fill no longer lets the aurora bleed through, so text is easier
		 * to read. Also implicitly disables refraction since opaque + ripple
		 * would just look smeary.
		 */
		opaque?: boolean;
		/**
		 * Refraction fidelity:
		 *   • "full"   — default; heavy ripple, good for hero panels.
		 *   • "subtle" — tighter noise, smaller scale; text stays readable.
		 *   • "none"   — L1+L2 only, no displacement layer.
		 * Falls back to L1+L2 on non-Chromium regardless of choice.
		 */
		refraction?: 'full' | 'subtle' | 'none';
		children: Snippet;
	}

	let {
		onclick,
		class: extraClass = '',
		strong = false,
		flat = false,
		opaque = false,
		refraction = 'full',
		children
	}: Props = $props();

	// `flat` is a legacy shorthand from before the refraction prop existed.
	// `opaque` implies no refraction — content-heavy surfaces shouldn't ripple.
	const effectiveRefraction = $derived(flat || opaque ? 'none' : refraction);

	// Feature-detect once at mount. Refraction stays off during SSR so the
	// initial paint matches the post-hydration render (no flash).
	let supported = $state(false);
	onMount(() => {
		supported = supportsBackdropSvgFilter();
	});

	const refractClass = $derived(
		!supported || effectiveRefraction === 'none'
			? ''
			: effectiveRefraction === 'subtle'
				? 'glass-refract-subtle'
				: 'glass-refract'
	);

	const interactive = $derived(typeof onclick === 'function');
</script>

{#if interactive}
	<button
		type="button"
		{onclick}
		class="glass glass-press focus-glass {strong ? 'glass-strong' : ''} {opaque
			? 'glass-opaque'
			: ''} {refractClass} {extraClass}"
	>
		{@render children()}
	</button>
{:else}
	<div
		class="glass {strong ? 'glass-strong' : ''} {opaque
			? 'glass-opaque'
			: ''} {refractClass} {extraClass}"
	>
		{@render children()}
	</div>
{/if}

<style>
	/* Reset button defaults so it inherits text color and uses our cursor. */
	button {
		appearance: none;
		background: inherit;
		color: inherit;
		font: inherit;
		text-align: inherit;
		cursor: pointer;
		display: block;
		width: 100%;
	}

	div,
	button {
		padding: 1.5rem;
	}
</style>
