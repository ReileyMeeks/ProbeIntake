// FormField is the runtime shape of one entry in an AppSource's `form_schema`
// JSONB column. Source of truth: `ticket-api/docs/design/form-schema.md`.
//
// IMPORTANT: when you change this type, mirror the change in:
//   ticket-api/Sources/TicketApi/Models/AppSource.swift  → struct FormField
// so the Vapor validator and the Svelte renderer interpret schemas identically.

export type FormFieldType = 'text' | 'select' | 'textarea' | 'number';

export interface FormField {
	/** Unique key within the schema, e.g. "category". Becomes the JSON key under `extra_fields`. */
	field: string;

	/** Input control type. */
	type: FormFieldType;

	/** Human label. Defaults to `field` when missing. */
	label?: string;

	/** Whether the field must be present in `extra_fields`. */
	required: boolean;

	/** Static option list for an independent select (no parent dependency). */
	options?: string[];

	/** Name of another field whose value gates the options for THIS field. */
	parentField?: string;

	/**
	 * Cascading select option map (Model C). Lookup key is the current value
	 * of `parentField`; result is the valid options for this field.
	 *
	 * Example:
	 *   parentField: "category"
	 *   optionsByParent: { "HVAC": ["Compressor", "Thermostat"], ... }
	 */
	optionsByParent?: Record<string, string[]>;

	/**
	 * Conditional visibility — render this field only when the named
	 * gate field's current value is one of `equals`. When unset, the
	 * field always renders. When set and the condition fails, the
	 * renderer skips the field AND the validator skips its required
	 * check (mirror of the Swift `shouldRender` helper).
	 */
	showWhen?: {
		field: string;
		equals: string[];
	};

	/**
	 * When set, the renderer ignores `options` / `optionsByParent` and instead
	 * fetches options from `GET /app-sources/:id/dynamic-options/:source` at
	 * render time. `dependsOn` is the field key whose value gates fetching
	 * (cascading dropdowns). Mirror of `DynamicOptions` on the Swift side.
	 */
	dynamicOptions?: {
		source: string;
		dependsOn?: string;
	};
}

/** Current values keyed by field name. Always string values (matches HTML form semantics). */
export type FormValues = Record<string, string>;
