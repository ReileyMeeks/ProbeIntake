<script lang="ts">
	interface Props {
		/** "shown" draws the sidebar column filled; "hidden" leaves it as an outline. */
		state?: 'shown' | 'hidden';
		size?: number;
		class?: string;
	}

	let { state = 'shown', size = 18, class: extraClass = '' }: Props = $props();
	// Mirrors Apple's SF Symbol `sidebar.left` — a rounded outer rectangle
	// with a thin vertical column on the left. When the sidebar is shown,
	// the column is filled; when hidden, it's outline-only. Same icon in
	// both states means the user reads it as "toggle sidebar" rather than
	// "sidebar status," which matches iPadOS behavior.
</script>

<svg
	width={size}
	height={size * (14 / 18)}
	viewBox="0 0 18 14"
	fill="none"
	stroke="currentColor"
	stroke-width="1.4"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={extraClass}
>
	<rect x="0.7" y="0.7" width="16.6" height="12.6" rx="2.4" />
	<line x1="5.6" y1="0.7" x2="5.6" y2="13.3" />
	{#if state === 'shown'}
		<rect x="1.4" y="1.4" width="3.5" height="11.2" rx="1.6" fill="currentColor" opacity="0.6" />
	{/if}
</svg>
