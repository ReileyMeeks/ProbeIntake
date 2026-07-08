<script lang="ts">
	interface Props {
		size?: number;
		class?: string;
	}
	let { size = 14, class: extraClass = '' }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 14 14"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={extraClass}
>
	<path d="M2 3.5h10" />
	<path d="M4.5 3.5V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V3.5" />
	<path d="M3.5 3.5v7a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-7" />
	<line x1="5.5" y1="5.5" x2="5.5" y2="9" />
	<line x1="8.5" y1="5.5" x2="8.5" y2="9" />
</svg>
