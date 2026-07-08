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
	<polyline points="2.5,7.5 5.75,10.75 11.5,3.75" />
</svg>
