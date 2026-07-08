import type { FormField, FormValues } from './types';

/**
 * Given a field and the current form values, return the list of valid
 * options for that field, or `null` if the field has no dependency (caller
 * should fall back to `field.options`).
 *
 * This function is the single source of truth for cascading-select semantics.
 * It is called by:
 *   • The Svelte form renderer to populate dependent <select> options + enable/disable state.
 *   • The Vapor validator (mirror in `ticket-api/Sources/TicketApi/Forms/FormSchema.swift`)
 *     to reject submissions whose `extra_fields` values aren't in the allowed set.
 *
 * Because client and server BOTH delegate here, the decisions below shape
 * how the entire ticket form behaves end-to-end.
 *
 * ─── YOUR CONTRIBUTION ──────────────────────────────────────────────────
 * Replace the `throw` with a real implementation. Three decisions to make,
 * each with a UX consequence — pick the option that matches how your
 * AppSource admins are likely to think:
 *
 *   1. Parent value not present in optionsByParent map.
 *      Examples of when this happens: admin added "Plumbing" as a category
 *      but forgot to add a corresponding subcategory entry.
 *
 *      a) return []
 *         → renderer disables the field, validator rejects any value.
 *         Strictest. Admin gaps surface as broken UI immediately.
 *
 *      b) return null
 *         → field treated as unconstrained (whatever the user types is valid).
 *         Most permissive. Admin gaps become silent data quality issues.
 *
 *      c) return field.options ?? []
 *         → fall back to the independent option list (if any).
 *         Hybrid. Useful if `options` is filled in as a default and
 *         `optionsByParent` is a per-category override.
 *
 *      My recommendation: (a). Strict failure is easier to debug than
 *      silent data drift. But (c) is reasonable if you want admins to
 *      provide an "anything goes" default.
 *
 *   2. Multi-level cascade (sub-sub-categories).
 *      Should this function recurse on its own, or is it the caller's job
 *      to evaluate level-by-level?
 *
 *      My recommendation: keep this non-recursive — pure, cacheable, one
 *      lookup per call. The renderer iterates fields in array order; each
 *      cascade step is one call.
 *
 *   3. User-typed custom values (a future `allowCustom: true` flag).
 *      Should this function know about that flag, or is custom-value
 *      handling a separate concern at the input layer?
 *
 *      My recommendation: separate concern. This function answers
 *      "what's in the constrained set?" — the input layer decides
 *      whether to allow values outside that set.
 *
 * Write 5–10 lines. When you're done, ping me and I'll mirror the same
 * three decisions into the Swift validator so both sides agree byte-for-byte.
 * ────────────────────────────────────────────────────────────────────────
 *
 * @param field      The FormField being rendered/validated.
 * @param formValues Current values keyed by field name.
 * @returns string[] when constrained, null when unconstrained.
 */
export function resolveDependentOptions(field: FormField, formValues: FormValues): string[] | null {
	if (!field.parentField) return null;
	const parentValue = formValues[field.parentField];
	if (parentValue === undefined || parentValue === '') return [];
	const map = field.optionsByParent;
	if (!map || !Object.prototype.hasOwnProperty.call(map, parentValue)) return [];
	return map[parentValue];
}
