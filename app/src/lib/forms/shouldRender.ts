import type { FormField, FormValues } from './types';

/**
 * Returns true when a field should render (and be subject to validation).
 * Mirror of the Vapor `shouldRender` helper — keep semantics identical so
 * frontend-validated forms agree with backend acceptance.
 *
 * Semantics:
 *   • no `showWhen`                                  → always render
 *   • gate field's value unset or empty string       → hide
 *   • gate field's value is in `equals` list         → render
 *   • gate field's value is NOT in `equals` list     → hide
 */
export function shouldRender(field: FormField, values: FormValues): boolean {
	const gate = field.showWhen;
	if (!gate) return true;
	const actual = values[gate.field];
	if (!actual) return false;
	return gate.equals.includes(actual);
}
