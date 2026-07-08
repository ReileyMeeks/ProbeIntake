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
	<line x1="3" y1="3" x2="11" y2="11" />
	<line x1="11" y1="3" x2="3" y2="11" />
</svg>
