/**
 * PDF report builder — ports the old HTML mockup's jsPDF report logic
 * (avante_probe_intake_FINAL (1).html, ~lines 790-920) into a typed,
 * testable module. Keeps the same overall shape (header, probe identity,
 * findings, repair quote, overall condition, optional images) but drops the
 * mockup's dark instrument-panel styling in favor of the app's calm
 * "Bench Instrument" tone — no emoji, sentence case, thin rules instead of
 * filled bands.
 */

import { jsPDF } from 'jspdf';
import type { AnalyzeResult, CapturedImage, ProbeMeta } from '$lib/domain/probe';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - MARGIN;

// Colors mirror the app's CSS tokens (layout.css --ink / --ink-2 / --ink-3 /
// --accent / --line / --sev-*) so the PDF reads as the same instrument, just
// on paper.
const INK: [number, number, number] = [14, 22, 38];
const INK_2: [number, number, number] = [70, 83, 107];
const INK_3: [number, number, number] = [138, 151, 172];
const ACCENT: [number, number, number] = [27, 77, 255];
const LINE: [number, number, number] = [228, 232, 239];

type Severity = 'major' | 'moderate' | 'minor' | 'pass' | 'flag';

const SEVERITY_COLOR: Record<Severity, [number, number, number]> = {
	major: [229, 72, 77],
	moderate: [245, 165, 36],
	minor: [138, 151, 172],
	pass: [48, 164, 108],
	flag: [27, 77, 255]
};

/** Normalizes the AI's free-text severity into the fixed signal vocabulary — mirrors ResultsView.svelte. */
function normalizeSeverity(raw: string): Severity {
	const lower = (raw ?? '').toLowerCase();
	if (lower.includes('major') || lower.includes('critical') || lower.includes('severe'))
		return 'major';
	if (lower.includes('moderate')) return 'moderate';
	if (lower.includes('minor') || lower.includes('cosmetic')) return 'minor';
	if (lower.includes('pass') || lower.includes('ok') || lower.includes('good')) return 'pass';
	return 'flag';
}

/** Starts a new page (with a repeated running header) if `needed` mm won't fit before the bottom margin. */
function ensureRoom(doc: jsPDF, y: number, needed: number): number {
	if (y + needed <= BOTTOM) return y;
	doc.addPage();
	drawRunningHeader(doc);
	return MARGIN + 8;
}

/** Thin "continued" header repeated on pages after the first. */
function drawRunningHeader(doc: jsPDF): void {
	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	doc.setTextColor(...INK_3);
	doc.text('Probe report (continued)', MARGIN, MARGIN);
	doc.setDrawColor(...LINE);
	doc.setLineWidth(0.3);
	doc.line(MARGIN, MARGIN + 3, PAGE_W - MARGIN, MARGIN + 3);
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(10);
	doc.setTextColor(...INK);
	doc.text(title, MARGIN, y);
	doc.setDrawColor(...LINE);
	doc.setLineWidth(0.3);
	doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
	return y + 8;
}

/**
 * Builds the quote report as a jsPDF document. `images` is optional context —
 * a missing or malformed `dataUrl` on any entry is skipped rather than
 * thrown, so one bad capture never breaks the whole export.
 */
export function buildReportPdf(
	result: AnalyzeResult,
	meta: ProbeMeta,
	images: CapturedImage[] = []
): jsPDF {
	const doc = new jsPDF({ unit: 'mm', format: 'a4' });
	let y = MARGIN;

	// ── Header ──────────────────────────────────────────────────────────
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(15);
	doc.setTextColor(...INK);
	doc.text('Probe report', MARGIN, y + 4);

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(9);
	doc.setTextColor(...INK_3);
	const today = new Date().toISOString().slice(0, 10);
	doc.text(today, PAGE_W - MARGIN, y + 4, { align: 'right' });
	y += 10;

	const model = result.probeId?.model ?? meta.model ?? '—';
	const mfg = result.probeId?.mfg;
	doc.setFont('helvetica', 'bold');
	doc.setFontSize(12);
	doc.setTextColor(...INK);
	doc.text(mfg ? `${model} · ${mfg}` : model, MARGIN, y + 4);
	y += 8;

	const codes: string[] = [];
	if (result.probeId?.sn) codes.push(`S/N ${result.probeId.sn}`);
	if (result.probeId?.ref) codes.push(`REF ${result.probeId.ref}`);
	if (meta.so) codes.push(`WO# ${meta.so}`);
	if (codes.length) {
		doc.setFont('courier', 'normal');
		doc.setFontSize(9);
		doc.setTextColor(...INK_2);
		doc.text(codes.join('   ·   '), MARGIN, y + 3);
		y += 7;
	}

	doc.setDrawColor(...LINE);
	doc.setLineWidth(0.5);
	doc.line(MARGIN, y, PAGE_W - MARGIN, y);
	y += 10;

	// ── Findings ────────────────────────────────────────────────────────
	y = ensureRoom(doc, y, 14);
	y = sectionTitle(doc, y, 'Findings');
	if (result.findings.length) {
		for (const f of result.findings) {
			const sev = normalizeSeverity(f.severity);
			const descLines = doc
				.setFont('helvetica', 'normal')
				.setFontSize(9)
				.splitTextToSize(f.description ?? '', CONTENT_W - 6);
			const rowHeight = 5 + descLines.length * 4.2 + 5;
			y = ensureRoom(doc, y, rowHeight);

			doc.setFillColor(...SEVERITY_COLOR[sev]);
			doc.circle(MARGIN + 1.2, y + 0.5, 1.1, 'F');

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(9.5);
			doc.setTextColor(...INK);
			doc.text(f.zone || 'Unspecified zone', MARGIN + 5, y + 1);

			doc.setFont('courier', 'normal');
			doc.setFontSize(7.5);
			doc.setTextColor(...INK_3);
			doc.text(`${sev} · ${f.source || 'visual'}`, PAGE_W - MARGIN, y + 1, { align: 'right' });

			doc.setFont('helvetica', 'normal');
			doc.setFontSize(9);
			doc.setTextColor(...INK_2);
			doc.text(descLines, MARGIN + 5, y + 5.5);

			y += rowHeight;
		}
	} else {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		doc.setTextColor(...INK_3);
		doc.text('No findings.', MARGIN, y + 2);
		y += 8;
	}
	y += 4;

	// ── Repair quote ────────────────────────────────────────────────────
	y = ensureRoom(doc, y, 14);
	y = sectionTitle(doc, y, 'Repair quote');
	if (result.quoteItems.length) {
		for (const q of result.quoteItems) {
			const ratLines = q.rationale
				? doc
						.setFont('helvetica', 'normal')
						.setFontSize(9)
						.splitTextToSize(q.rationale, CONTENT_W - 6)
				: [];
			const rowHeight = 5 + ratLines.length * 4.2 + 5;
			y = ensureRoom(doc, y, rowHeight);

			doc.setFont('helvetica', 'bold');
			doc.setFontSize(9.5);
			doc.setTextColor(...INK);
			doc.text(q.item, MARGIN, y + 1);

			doc.setFont('courier', 'normal');
			doc.setFontSize(7.5);
			doc.setTextColor(...ACCENT);
			doc.text((q.priority || '').toUpperCase(), PAGE_W - MARGIN, y + 1, { align: 'right' });

			if (ratLines.length) {
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(9);
				doc.setTextColor(...INK_2);
				doc.text(ratLines, MARGIN, y + 5.5);
			}

			y += rowHeight;
		}
	} else {
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(9);
		doc.setTextColor(...INK_3);
		doc.text('No quote items.', MARGIN, y + 2);
		y += 8;
	}
	y += 4;

	// ── Overall condition + confidence ─────────────────────────────────
	y = ensureRoom(doc, y, 16);
	doc.setDrawColor(...LINE);
	doc.setLineWidth(0.3);
	doc.line(MARGIN, y, PAGE_W - MARGIN, y);
	y += 7;

	doc.setFont('helvetica', 'normal');
	doc.setFontSize(8);
	doc.setTextColor(...INK_3);
	doc.text('OVERALL CONDITION', MARGIN, y);
	doc.text('CONFIDENCE', PAGE_W - MARGIN - 30, y);

	doc.setFont('helvetica', 'bold');
	doc.setFontSize(11);
	doc.setTextColor(...INK);
	doc.text(result.overallCondition || '—', MARGIN, y + 5);
	doc.setFont('courier', 'bold');
	doc.text(`${result.confidence}%`, PAGE_W - MARGIN - 30, y + 5);
	y += 14;

	// ── Optional images ─────────────────────────────────────────────────
	if (images.length) {
		y = ensureRoom(doc, y, 14);
		y = sectionTitle(doc, y, `Captured images (${images.length})`);

		const cols = 3;
		const gap = 3;
		const imgW = (CONTENT_W - (cols - 1) * gap) / cols;
		const imgH = imgW * 0.75;
		let col = 0;

		for (const img of images) {
			if (col === 0) y = ensureRoom(doc, y, imgH + 6);
			const x = MARGIN + col * (imgW + gap);
			try {
				const format = formatFor(img.mediaType);
				doc.addImage(img.dataUrl, format, x, y, imgW, imgH);
				if (img.zone) {
					doc.setFont('helvetica', 'normal');
					doc.setFontSize(6.5);
					doc.setTextColor(...INK_3);
					doc.text(img.zone, x, y + imgH + 3);
				}
			} catch {
				// A single malformed capture (bad base64, unsupported codec) never
				// breaks the report — the slot is simply left blank.
			}
			col++;
			if (col >= cols) {
				col = 0;
				y += imgH + 8;
			}
		}
		if (col > 0) y += imgH + 8;
	}

	return doc;
}

/** Maps a captured image's MIME type to the format string jsPDF's addImage expects. */
function formatFor(mediaType: string): string {
	if (mediaType.includes('png')) return 'PNG';
	if (mediaType.includes('webp')) return 'WEBP';
	return 'JPEG';
}

/** The PDF's bytes as base64, without the `data:application/pdf;...;base64,` prefix — ready for `contentBytes`. */
export function pdfBase64(doc: jsPDF): string {
	const uri = doc.output('datauristring');
	const comma = uri.indexOf(',');
	return comma === -1 ? uri : uri.slice(comma + 1);
}
