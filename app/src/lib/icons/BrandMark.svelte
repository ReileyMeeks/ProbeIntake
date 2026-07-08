<script lang="ts">
	let { size = '1em', title = 'Template App' }: { size?: string; title?: string } = $props();
</script>

<!-- Brand mark uses fixed two-tone brand colors (blue diamond + white mark),
     matching static/favicon.svg. Not theme-recolored by design. -->
<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 32 32"
	width={size}
	height={size}
	role="img"
	aria-label={title}
	class="brand-svg"
>
	<path d="M16 1 L30 16 L16 31 L2 16 Z" fill="#3b82f6" />
	<path
		d="M10 20 L14 14 L18 17 L22 10"
		fill="none"
		stroke="white"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<line x1="16" y1="22" x2="16" y2="25" stroke="white" stroke-width="2" stroke-linecap="round" />
</svg>

<style>
	.brand-svg {
		display: block;
		flex: none;
	}
</style>
