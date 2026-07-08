<script lang="ts">
	import type { TicketStatus } from '$lib/api/types';

	interface Props {
		status: TicketStatus;
		size?: 'sm' | 'md';
	}

	let { status, size = 'sm' }: Props = $props();

	// Human-friendly labels — `in_progress` → "In Progress", etc.
	const LABEL: Record<TicketStatus, string> = {
		open: 'Open',
		in_progress: 'In Progress',
		resolved: 'Resolved',
		closed: 'Closed',
		triage: 'Triage'
	};
</script>

<span class="pill pill-{status} pill-{size}">
	<span class="dot" aria-hidden="true"></span>
	{LABEL[status]}
</span>

<style>
	/*
	 * Background + border derive from the pill color via color-mix so a
	 * "Resolved" pill is greenish-tinted in both themes, just with very
	 * different lightness ratios. Without the tint the pill blends into
	 * the card on light backgrounds and loses its category signal.
	 */
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.1875rem 0.625rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		line-height: 1.4;
		background: color-mix(in srgb, var(--pill-color) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--pill-color) 32%, transparent);
		color: var(--pill-color);
		white-space: nowrap;
	}
	.pill-md {
		padding: 0.3125rem 0.75rem;
		font-size: 0.8125rem;
	}
	.dot {
		width: 0.4375rem;
		height: 0.4375rem;
		border-radius: 999px;
		background: var(--pill-color);
		box-shadow: 0 0 6px color-mix(in srgb, var(--pill-color) 60%, transparent);
		flex-shrink: 0;
	}
	.pill-open {
		--pill-color: var(--color-status-open);
	}
	.pill-in_progress {
		--pill-color: var(--color-status-in-progress);
	}
	.pill-resolved {
		--pill-color: var(--color-status-resolved);
	}
	.pill-closed {
		--pill-color: var(--color-status-closed);
	}
	.pill-triage {
		--pill-color: var(--color-status-triage);
	}
</style>
