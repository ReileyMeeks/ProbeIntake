<script lang="ts">
	import type { TicketPriority } from '$lib/api/types';

	interface Props {
		priority: TicketPriority;
		size?: 'sm' | 'md';
	}

	let { priority, size = 'sm' }: Props = $props();

	const LABEL: Record<TicketPriority, string> = {
		low: 'Low',
		medium: 'Medium',
		high: 'High',
		critical: 'Critical'
	};
</script>

<span class="pill pill-{priority} pill-{size}">{LABEL[priority]}</span>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		padding: 0.1875rem 0.625rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		line-height: 1.4;
		/* Tinted background derived from the priority color so the pill
		   reads as a single chip rather than a colored dot + label. */
		background: color-mix(in srgb, var(--pill-color) 18%, transparent);
		border: 1px solid color-mix(in srgb, var(--pill-color) 36%, transparent);
		color: var(--pill-color);
		white-space: nowrap;
	}
	.pill-md {
		padding: 0.3125rem 0.75rem;
		font-size: 0.8125rem;
	}
	.pill-low {
		--pill-color: var(--color-priority-low);
	}
	.pill-medium {
		--pill-color: var(--color-priority-medium);
	}
	.pill-high {
		--pill-color: var(--color-priority-high);
	}
	.pill-critical {
		--pill-color: var(--color-priority-critical);
	}
</style>
