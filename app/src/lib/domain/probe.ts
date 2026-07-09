/**
 * Probe Intake domain types — mirror of the proxy's `/api/analyze` request
 * and response shapes (proxy/Sources/ProbeProxy/DTOs/Analyze*.swift).
 */

/** Free-form metadata captured on the intake form (work order, unit id, etc). */
export interface ProbeMeta {
	[k: string]: string;
}

/** An image captured/selected in the browser, ready to send to /api/analyze. */
export interface CapturedImage {
	mediaType: string;
	base64: string;
	isForm: boolean;
	dataUrl: string;
	zone?: string;
}

export interface Finding {
	zone: string;
	description: string;
	severity: string;
	source: string;
}

export interface QuoteItem {
	item: string;
	priority: string;
	rationale: string;
}

export interface AnalyzeResult {
	probeId: Record<string, string>;
	findings: Finding[];
	quoteItems: QuoteItem[];
	overallCondition: string;
	confidence: number;
	notes: string;
}
