/**
 * Date + duration formatting helpers. Kept TS-only so they're shared
 * across server-render and client paths without component coupling.
 *
 * All inputs are the ISO 8601 strings the Vapor backend emits.
 */

/**
 * "2026-05-12 10:34" — local time, no timezone, ASCII-safe. Used in
 * thread timestamps where multiple messages are stacked and a compact
 * format reads better than a long-form date.
 */
export function formatDateTime(iso?: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * "May 12, 2026" — long-form date for ticket headers + the few places
 * where the year matters more than the minute.
 */
export function formatDate(iso?: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Relative time — "3 minutes ago", "yesterday", "2 weeks ago". Used in
 * list views where exact timestamps add noise but recency cues help
 * the user prioritize. Uses Intl.RelativeTimeFormat so locale rules
 * (e.g., "il y a 3 minutes") come for free.
 */
export function formatRelative(iso?: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	const seconds = (d.getTime() - Date.now()) / 1000;
	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

	// Walk the units from largest to smallest until one represents the
	// delta with a non-zero integer — that's the unit that reads naturally.
	const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
		['year', 60 * 60 * 24 * 365],
		['month', 60 * 60 * 24 * 30],
		['week', 60 * 60 * 24 * 7],
		['day', 60 * 60 * 24],
		['hour', 60 * 60],
		['minute', 60],
		['second', 1]
	];
	for (const [unit, secondsInUnit] of units) {
		if (Math.abs(seconds) >= secondsInUnit || unit === 'second') {
			return rtf.format(Math.round(seconds / secondsInUnit), unit);
		}
	}
	return '';
}
