import type { FormValues } from './types';

/**
 * Replaces `{{fieldKey}}` tokens with values from `formValues` (preferred)
 * or `builtIn` (fallback for system slots like subject, category, etc.).
 * Mirror of the Vapor `renderSubjectTemplate` helper — keep semantics
 * identical so the dashboard's live preview agrees with what the backend
 * actually stores at create time.
 *
 * Conservative grammar: `{{[A-Za-z0-9_]+}}` only. No nested braces, no
 * whitespace inside braces, no escape. Unknown keys collapse to empty.
 * Result is trimmed.
 */
export function renderSubjectTemplate(
	template: string,
	formValues: FormValues,
	builtIn: Record<string, string> = {}
): string {
	if (!template) return '';
	const tokenRe = /\{\{([A-Za-z0-9_]+)\}\}/g;
	const out = template.replace(tokenRe, (_match, key: string) => {
		return formValues[key] ?? builtIn[key] ?? '';
	});
	return out.trim();
}
