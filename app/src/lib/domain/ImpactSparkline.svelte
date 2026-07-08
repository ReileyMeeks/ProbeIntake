<script lang="ts">
	let { m25, m26 }: { m25: number | null; m26: number | null } = $props();
	const W = 60;
	const H = 18;
	const MID = H / 2;
	const bar = (v: number | null) => (v === null ? 0 : Math.max(-1, Math.min(1, v)) * (H / 2 - 1));
</script>

<svg width={W} height={H} aria-label={`2025 ${m25 ?? '—'} vs 2026 ${m26 ?? '—'}`}>
	<line x1="0" y1={MID} x2={W} y2={MID} stroke="#ccc" stroke-width="1" />
	<rect x="6" y={MID - Math.max(0, bar(m25))} width="20" height={Math.abs(bar(m25))} fill="#444" />
	<rect x="34" y={MID - Math.max(0, bar(m26))} width="20" height={Math.abs(bar(m26))} fill="#666" />
</svg>
