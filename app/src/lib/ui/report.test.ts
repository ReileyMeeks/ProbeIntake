import { describe, it, expect } from 'vitest';
import { buildReportPdf, pdfBase64 } from './report';
import type { AnalyzeResult, ProbeMeta, CapturedImage } from '$lib/domain/probe';

const RESULT: AnalyzeResult = {
	probeId: { model: 'C1-6-D', mfg: 'GE Healthcare', sn: '250840YP6', ref: '5418916' },
	findings: [
		{
			zone: 'Strain Relief',
			description: 'Visible cracking and separation at the boot-to-cable junction.',
			severity: 'major',
			source: 'image:strain'
		}
	],
	quoteItems: [
		{
			item: 'Retermination',
			priority: 'Required',
			rationale: 'Strain relief failure risks cable conductor damage in service.'
		}
	],
	overallCondition: 'Fair',
	confidence: 62,
	notes: ''
};

const META: ProbeMeta = { model: 'C1-6-D', so: 'SO-42' };

describe('buildReportPdf', () => {
	it('produces a non-empty pdf', () => {
		const doc = buildReportPdf(
			{
				probeId: { model: 'C1-6' },
				findings: [],
				quoteItems: [],
				overallCondition: 'ok',
				confidence: 90,
				notes: ''
			},
			{ model: 'C1-6' },
			[]
		);
		const out = doc.output('datauristring');
		expect(out.startsWith('data:application/pdf')).toBe(true);
	});

	it('includes findings, quote items, and probe identity with a fuller fixture', () => {
		const doc = buildReportPdf(RESULT, META, []);
		const dataUri = doc.output('datauristring');
		expect(dataUri.startsWith('data:application/pdf')).toBe(true);
		// jsPDF doesn't compress streams by default, so the words written via
		// doc.text(...) are findable as plain substrings once the base64
		// payload is decoded back to raw PDF bytes. `atob` (not `Buffer`,
		// which isn't typed here) keeps this test runnable under both node
		// and jsdom.
		const raw = atob(pdfBase64(doc));
		expect(raw).toContain('C1-6-D');
		expect(raw).toContain('Retermination');
	});

	it('does not throw when images are present, even if malformed', () => {
		const images: CapturedImage[] = [
			{
				mediaType: 'image/jpeg',
				base64: 'not-real-base64',
				isForm: false,
				dataUrl: 'data:image/jpeg;base64,not-real-base64',
				zone: 'Lens'
			}
		];
		expect(() => buildReportPdf(RESULT, META, images)).not.toThrow();
	});
});

describe('pdfBase64', () => {
	it('returns base64 without the data URL prefix', () => {
		const doc = buildReportPdf(RESULT, META, []);
		const b64 = pdfBase64(doc);
		expect(b64.startsWith('data:')).toBe(false);
		expect(b64).toMatch(/^[A-Za-z0-9+/=]+$/);
		expect(atob(b64).slice(0, 5)).toBe('%PDF-');
	});
});
