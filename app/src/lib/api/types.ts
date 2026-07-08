/**
 * Wire types — mirror of Vapor DTOs (ticket-api/Sources/TicketApi/DTOs/* and
 * the various controller Response shapes).
 *
 * Keep this file in sync with the backend by hand for now. When the API
 * surface stabilizes we can generate from OpenAPI; until then, this is
 * a small enough set that manual mirroring is faster than tooling.
 */

// ─── Enums ───────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'triage';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type SenderType = 'user' | 'admin' | 'ai' | 'system';
export type UploadStatus = 'uploading' | 'uploaded' | 'failed';
export type UserRole = 'admin' | 'agent' | 'supervisor' | 'user';

export interface AppUser {
	id: string;
	auth0Sub: string;
	email: string;
	name?: string | null;
	role: UserRole;
	appSourceIDs: string[];
	lastLoginAt?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

export interface CreateAppUserRequest {
	auth0Sub: string;
	email: string;
	name?: string;
	role: UserRole;
	appSourceIDs?: string[];
}

export interface InviteUserRequest {
	email: string;
	name?: string;
	role: UserRole;
	appSourceIDs?: string[];
}

export interface UpdateAppUserRequest {
	email?: string;
	name?: string;
	role?: UserRole;
	appSourceIDs?: string[];
	lastLoginAt?: string | null;
}

// ─── Tickets ─────────────────────────────────────────────────────────

export interface Ticket {
	id: string;
	ticketId: string;
	appSourceSlug: string;
	appSourceName: string;
	subject: string;
	description?: string | null;
	category?: string | null;
	issueType?: string | null;
	priority: TicketPriority;
	status: TicketStatus;
	submittedByEmail: string;
	submittedByName?: string | null;
	assignedTo?: string | null;
	extraFields?: Record<string, string> | null;
	hoursWorked?: number | null;
	resolvedAt?: string | null;
	mondayItemId?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

export interface CreateTicketRequest {
	appSourceSlug: string;
	subject: string;
	description?: string;
	category?: string;
	issueType?: string;
	priority?: TicketPriority;
	extraFields?: Record<string, string>;
}

export interface UpdateTicketRequest {
	status?: TicketStatus;
	priority?: TicketPriority;
	assignedTo?: string;
	hoursWorked?: number;
}

export interface AssignableUser {
	id: string;
	email: string;
	name?: string | null;
	role: UserRole;
}

// ─── Messages ────────────────────────────────────────────────────────

export interface TicketMessage {
	id: string;
	ticketId: string;
	senderEmail: string;
	senderType: SenderType;
	message: string;
	isInternal: boolean;
	createdAt?: string;
}

export interface CreateMessageRequest {
	message: string;
	isInternal?: boolean;
}

// ─── Attachments ─────────────────────────────────────────────────────

export interface Attachment {
	id: string;
	ticketID: string;
	fileName: string;
	fileSize?: number | null;
	mimeType?: string | null;
	uploadStatus: UploadStatus;
	uploadError?: string | null;
	uploadedBy: string;
	createdAt?: string;
	downloadable: boolean;
}

// ─── Monday board columns (admin lookup) ─────────────────────────────

export interface MondayColumn {
	id: string;
	title: string;
	type?: string | null;
}

// ─── App sources ─────────────────────────────────────────────────────

export type FormFieldType = 'text' | 'select' | 'textarea' | 'number';

export interface FormField {
	field: string;
	type: FormFieldType;
	label?: string;
	required: boolean;
	options?: string[];
	parentField?: string;
	optionsByParent?: Record<string, string[]>;
	showWhen?: {
		field: string;
		equals: string[];
	};
	/**
	 * When set, the renderer ignores `options` / `optionsByParent` and instead
	 * fetches options from `GET /app-sources/:id/dynamic-options/:source` at
	 * render time. `dependsOn` declares the parent field whose value gates
	 * fetching (cascading dropdowns). Mirrors `DynamicOptions` on the Swift side.
	 */
	dynamicOptions?: {
		source: string;
		dependsOn?: string;
	};
}

/** One option returned by the dynamic-options endpoint. */
export interface DynamicOption {
	id: string;
	label: string;
}

/** Per-AppSource RemoteSite integration config — JSONB-shaped struct that
 *  declares how the dashboard's dynamic-options endpoint resolves logical
 *  source names to upstream RemoteSite paths. */
export interface RemoteSiteIntegration {
	baseURL: string;
	sources: Record<string, RemoteSiteSource>;
}

export interface RemoteSiteSource {
	path: string;
	idKey: string;
	labelKey: string;
	dependsOn?: string;
}

export interface AppSourceAiSettings {
	enabled?: boolean | null;
	model?: string | null;
	autoCategorize?: boolean | null;
	firstResponse?: boolean | null;
	smartRouting?: boolean | null;
	summarizeThreads?: boolean | null;
	resolutionSuggestions?: boolean | null;
}

export interface MondayBoardConfig {
	ticketIdColumn?: string | null;
	statusColumn?: string | null;
	submitterNameColumn?: string | null;
	submitterEmailColumn?: string | null;
	descriptionColumn?: string | null;
	assignedToColumn?: string | null;
	hoursWorkedColumn?: string | null;
}

export interface AppSource {
	id: string;
	name: string;
	slug: string;
	mondayBoardId?: string | null;
	mondayBoardConfig: MondayBoardConfig;
	mondayInboundEnabled: boolean;
	/**
	 * `subjectTemplate` is optional. When set, /tickets/new derives the
	 * subject by interpolating form values (and built-in slots) into the
	 * template; the manual subject input is suppressed in the renderer.
	 */
	formSchema: { fields: FormField[]; subjectTemplate?: string };
	aiSettings: AppSourceAiSettings;
	/** Nullable — only set when this AppSource has been configured to pull
	 *  dropdown options from RemoteSite. See `RemoteSiteIntegration`. */
	remoteSiteIntegration?: RemoteSiteIntegration | null;
	createdAt?: string;
	updatedAt?: string;
}

export interface CreateAppSourceRequest {
	name: string;
	slug: string;
	mondayBoardId?: string;
	formSchema?: { fields: FormField[]; subjectTemplate?: string };
	aiSettings?: AppSourceAiSettings;
	remoteSiteIntegration?: RemoteSiteIntegration;
}

export interface UpdateAppSourceRequest {
	name?: string;
	mondayBoardId?: string | null;
	mondayBoardConfig?: MondayBoardConfig;
	mondayInboundEnabled?: boolean;
	formSchema?: { fields: FormField[]; subjectTemplate?: string };
	aiSettings?: AppSourceAiSettings;
	remoteSiteIntegration?: RemoteSiteIntegration;
	/** Set true to explicitly clear remoteSiteIntegration (Swift can't distinguish absent vs null for T?). */
	clearRemoteSiteIntegration?: boolean;
}

// ─── AI config + instructions ────────────────────────────────────────

export interface AiConfig {
	id: string;
	globalEnabled: boolean;
	defaultModel: string;
	provider: 'anthropic' | 'azure_ai_foundry' | string;
	autoCloseStale: boolean;
	autoCloseDays: number;
	updatedBy?: string | null;
	updatedAt?: string;
}

export interface UpdateAiConfigRequest {
	globalEnabled?: boolean;
	defaultModel?: string;
	provider?: string;
	autoCloseStale?: boolean;
	autoCloseDays?: number;
}

export interface AiInstruction {
	id: string;
	appSourceID: string;
	label: string;
	category?: string | null;
	issueType?: string | null;
	instructions: string;
	createdBy: string;
	updatedBy?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

export interface CreateAiInstructionRequest {
	label: string;
	category?: string;
	issueType?: string;
	instructions: string;
}

export interface UpdateAiInstructionRequest {
	label?: string;
	category?: string;
	issueType?: string;
	instructions?: string;
}

export interface RefineInstructionRequest {
	label: string;
	instructions: string;
	category?: string;
	issueType?: string;
}

// ─── AI on-demand action responses ───────────────────────────────────

export interface SummarizeResponse {
	summary: string;
}

export interface SuggestResolutionResponse {
	suggestions: string;
}

export interface RefineInstructionResponse {
	refined: string;
}

// ─── Health ──────────────────────────────────────────────────────────

export interface HealthResponse {
	status: string;
	mondayPendingJobs: number;
	mondayFailedJobs: number;
	mondayAbandonedJobs: number;
	aiPendingJobs: number;
	aiFailedJobs: number;
	aiAbandonedJobs: number;
}

// ─── User Activity Analytics ────────────────────────────────────────

export interface DayCount {
	date: string;
	count: number;
}

export interface AnalyticsBucket {
	key: string;
	label: string;
	count: number;
}

export interface UserActivityDay {
	date: string;
	count: number;
}

export interface UserBreakdownRow {
	id: string;
	name: string | null;
	email: string;
	role: string;
	reports_created: number;
	last_active: string | null;
}

export interface UserActivityResponse {
	days: UserActivityDay[];
	total_users: number;
	active_users_30d: number;
	logins_by_day: DayCount[];
	active_users: number;
	new_users_by_day: DayCount[];
	role_breakdown: AnalyticsBucket[];
	actions_by_day: DayCount[];
	user_breakdown: UserBreakdownRow[];
}

export interface RecentAnalysis {
	id: string;
	name: string;
	created_at: string;
	status: string;
}

export interface MyActivityResponse {
	events_by_day: DayCount[];
	analyses_created: number;
	exports_run: number;
	analyses_created_window: number;
	exports_run_window: number;
	current_streak: number;
	longest_streak: number;
	last_active: string | null;
	recent_analyses: RecentAnalysis[];
}
