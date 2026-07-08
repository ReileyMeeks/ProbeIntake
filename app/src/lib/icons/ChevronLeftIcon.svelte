<script lang="ts">
	interface Props {
		size?: number;
		class?: string;
	}
	let { size = 16, class: extraClass = '' }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={extraClass}
>
	<polyline points="10,3 5,8 10,13" />
</svg>
