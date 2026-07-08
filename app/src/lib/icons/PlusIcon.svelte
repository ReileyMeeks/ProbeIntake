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
	<line x1="7" y1="2.5" x2="7" y2="11.5" />
	<line x1="2.5" y1="7" x2="11.5" y2="7" />
</svg>
