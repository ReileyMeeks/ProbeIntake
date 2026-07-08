// place files you want to import through the `$lib` alias in this folder.

export { default as DynamicForm } from './forms/DynamicForm.svelte';
export { default as FormSchemaEditor } from './forms/FormSchemaEditor.svelte';
export { resolveDependentOptions } from './forms/resolveDependentOptions';
export { shouldRender } from './forms/shouldRender';
export { renderSubjectTemplate } from './forms/renderSubjectTemplate';
export type { FormField, FormFieldType, FormValues } from './forms/types';

// Glass design primitives (Phase 4 A2+A3)
export * from './glass';

// API client (Phase 4 A4)
export * as api from './api/client';
export { ApiError } from './api/client';
export type * from './api/types';

// Shared UI utilities (Phase 4 B0)
export * from './ui';

// Analytics computations (frontend)
export * from './analytics';

// Analytics types (API responses)
export type {
	AnalyticsBucket,
	DayCount,
	MyActivityResponse,
	RecentAnalysis,
	UserActivityDay,
	UserActivityResponse
} from './api/types';
