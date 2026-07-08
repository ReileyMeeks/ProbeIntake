<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { supportsBackdropSvgFilter } from './featureDetect';

	interface Props {
		/** Sticky to viewport top by default. Set false for inline toolbars. */
		sticky?: boolean;
		class?: string;
		children: Snippet;
	}

	let { sticky = true, class: extraClass = '', children }: Props = $props();

	// L3 refraction is appropriate for a floating pill toolbar — the design
	// contract permits L3 on dialogs and elevated surfaces, and a free-floating
	// toolbar reads as elevated rather than edge-aligned chrome.
	let refract = $state(false);
	onMount(() => {
		refract = supportsBackdropSvgFilter();
	});
</script>

<header
	class="glass glass-press-soft focus-glass float-toolbar {refract ? 'glass-refract' : ''} {sticky
		? 'sticky-toolbar'
		: ''} {extraClass}"
>
	{@render children()}
</header>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 1.25rem;
		padding: 0.4375rem 1rem;
		width: max-content;
	}
	/* Indented/inset compact bar — not a floating pill. */
	.float-toolbar {
		border-radius: 2rem;
	}
	.sticky-toolbar {
		position: sticky;
		top: 0.5rem;
		z-index: 20;
		/* Inset shadow: top-inner darkness makes the bar look recessed into the
		   page surface rather than floating above it. */
		--shadow-glass-md:
			inset 0 2px 5px rgb(0 0 0 / 0.28), inset 0 1px 0 rgb(255 255 255 / 0.05),
			0 0 0 1px var(--color-glass-border);
	}
	/* Light mode: softer inset since contrast is lower against the warm bg */
	:global(html[data-theme='light']) .sticky-toolbar {
		--shadow-glass-md: inset 0 2px 4px rgb(0 0 0 / 0.1), 0 0 0 1px rgb(0 0 0 / 0.07);
	}
	/* Softer press feedback than buttons — the toolbar isn't directly
	   clickable so we don't want a noticeable hover state on it. */
	.glass-press-soft {
		transition: box-shadow 240ms var(--ease-glass);
	}
</style>
