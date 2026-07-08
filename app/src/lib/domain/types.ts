export type RankedImpact = {
	combo_hash: string;
	combo: [string, string, string, string, string];
	rev_2025: number;
	rev_2026: number;
	cost_2025: number;
	cost_2026: number;
	margin_pct_2025: number | null;
	margin_pct_2026: number | null;
	impact_usd: number | null;
	flags: string[];
};

export type Pattern = 'cost_squeeze' | 'price_concession' | 'mix_shift';

export type Candidate = {
	pattern: Pattern;
	customer: string;
	item: string | null;
	evidence: Record<string, unknown>;
	impact_usd: number;
};

export type Narration = {
	headline: string;
	patterns: {
		pattern: Pattern;
		customers: string[];
		bullet: string;
		supporting_candidates: number[];
	}[];
	caveats: string[];
	source: 'claude' | 'template';
};

export type Findings = {
	candidates: Candidate[];
	narration: Narration | null;
	reconciliation: {
		parent_impact_usd: number | null;
		sum_candidates_usd: number;
		residual_usd: number;
		over_attributed: boolean;
	} | null;
	no_drilldown: boolean;
};

export type AnalysisSummary = {
	id: string;
	name: string;
	status: string;
	created_at: string;
	has_export2: boolean;
	created_by?: string;
	created_by_name?: string;
};

export type ColumnMapping = {
	business: string;
	sales_channel: string;
	sales_type: string;
	revenue_type: string;
	new_or_other: string;
	revenue: string;
	material_cost: string;
	margin_pct: string;
	year: string;
};

export type Export2ColumnMapping = ColumnMapping & {
	customer: string;
	item: string;
	qty: string;
	description?: string;
};

export type Thresholds = {
	price_flat_band_pct: number;
	cost_spike_pct: number;
	price_drop_pct: number;
	mix_drop_pp: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
	price_flat_band_pct: 2.0,
	cost_spike_pct: 5.0,
	price_drop_pct: 3.0,
	mix_drop_pp: 3.0
};

export type UserRole = 'individual' | 'manager' | 'admin';

export type Me = {
	id: string;
	email: string;
	name: string | null;
	role: UserRole;
};

export type AdminUser = {
	id: string;
	email: string;
	name: string | null;
	role: UserRole;
	created_at: string;
};

export type InviteUserInput = {
	email: string;
	name?: string;
	role: UserRole;
};

export type CompareCell = {
	present: boolean;
	impact_usd: number | null;
	margin_pct_2025: number | null;
	margin_pct_2026: number | null;
	rev_2025: number | null;
	rev_2026: number | null;
	impact_delta_vs_baseline: number | null;
};

export type CompareSummary = {
	id: string;
	name: string;
	created_by_name: string;
	total_rev_2025: number | null;
	total_rev_2026: number | null;
	total_impact_usd: number | null;
	top_movers: string[][];
};

export type CompareRow = {
	combo_hash: string;
	combo: string[];
	cells: CompareCell[];
};

export type Comparison = {
	summaries: CompareSummary[];
	rows: CompareRow[];
};

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
	role: ChatRole;
	content: string;
	created_at?: string;
};

export type ChatStreamEvent =
	| { type: 'token'; text: string }
	| { type: 'tool'; name: string }
	| { type: 'done'; text: string; prompt_tokens: number; output_tokens: number }
	| { type: 'error'; message: string };

export type ChatConversationSummary = {
	id: string;
	title: string | null;
	created_at: string;
	message_count: number;
};

export type Export2DescriptionNode = {
	description: string;
	rev_2025: number;
	rev_2026: number;
	cost_2025: number;
	cost_2026: number;
	margin_pct_2025: number | null;
	margin_pct_2026: number | null;
	impact_usd: number | null;
};

export type Export2ItemNode = {
	item: string;
	rev_2025: number;
	rev_2026: number;
	cost_2025: number;
	cost_2026: number;
	margin_pct_2025: number | null;
	margin_pct_2026: number | null;
	impact_usd: number | null;
	descriptions: Export2DescriptionNode[];
};

export type Export2CustomerNode = Omit<Export2ItemNode, 'item' | 'descriptions'> & {
	customer: string;
	items: Export2ItemNode[];
};

export type Export2Subtree = {
	available: boolean;
	customers: Export2CustomerNode[];
};
