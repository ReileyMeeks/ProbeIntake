export function fmtUsd(v: number | null): string {
	if (v === null || v === undefined) return '—';
	const sign = v < 0 ? '-' : '';
	return `${sign}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
}

export function fmtDelta(v: number | null): string {
	if (v === null || v === undefined) return '—';
	const sign = v < 0 ? '-' : '+';
	return `${sign}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
}
