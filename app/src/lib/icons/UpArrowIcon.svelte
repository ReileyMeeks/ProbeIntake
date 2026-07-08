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
	stroke-width="1.85"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={extraClass}
>
	<line x1="7" y1="10.5" x2="7" y2="2.5" />
	<polyline points="3.5,6 7,2.5 10.5,6" />
</svg>
