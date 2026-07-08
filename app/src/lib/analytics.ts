// Pure activity-analytics helpers shared by the admin and personal dashboards.

// ─── Day helpers ────────────────────────────────────────────────────

export function formatActivityDate(dateStr: string): string {
	const d = new Date(dateStr + 'T00:00:00');
	return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Day-bucketed series (from the API) ─────────────────────────────

export interface DayCount {
	date: string;
	count: number;
}

// ─── Breakdowns ─────────────────────────────────────────────────────

export interface Bucket {
	key: string;
	label: string;
	count: number;
	pct: number;
}

/** Count occurrences of each key, attach percentages, sort count-desc. */
export function bucketize(keys: string[], labelMap?: Record<string, string>): Bucket[] {
	const counts = new Map<string, number>();
	for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
	const total = keys.length || 1;
	return Array.from(counts.entries())
		.map(([key, count]) => ({
			key,
			label: labelMap?.[key] ?? key,
			count,
			pct: Math.round((count / total) * 100)
		}))
		.sort((a, b) => b.count - a.count);
}

// ─── Streaks ────────────────────────────────────────────────────────

export interface Streaks {
	current: number;
	longest: number;
}

function epochDay(dateStr: string): number {
	return Math.round(new Date(dateStr + 'T00:00:00Z').getTime() / 86_400_000);
}

/** current/longest consecutive-day streaks from a list of active YYYY-MM-DD
 *  dates. Current stays alive if active today OR yesterday (relative to `today`). */
export function computeStreaks(activeDates: string[], today: string): Streaks {
	if (activeDates.length === 0) return { current: 0, longest: 0 };
	const set = new Set(activeDates.map(epochDay));

	let longest = 0;
	for (const day of set) {
		if (set.has(day - 1)) continue; // not the start of a run
		let len = 1;
		let cursor = day;
		while (set.has(cursor + 1)) {
			cursor += 1;
			len += 1;
		}
		longest = Math.max(longest, len);
	}

	const t = epochDay(today);
	let cursor = set.has(t) ? t : t - 1;
	let current = 0;
	while (set.has(cursor)) {
		current += 1;
		cursor -= 1;
	}

	return { current, longest };
}
