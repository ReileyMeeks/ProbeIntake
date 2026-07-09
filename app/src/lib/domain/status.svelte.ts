/**
 * Tiny shared reactive module for the top strip's status chip + WO# readout.
 *
 * The intake workspace (`+page.svelte`) owns the actual analyze lifecycle
 * and metadata; the top strip lives in `+layout.svelte`, a sibling with no
 * direct prop path to it. Rather than thread a store through page data (this
 * is a static SPA with no shared load function), a module-scoped rune is the
 * simplest thing that works: both files import the same singleton.
 */

let status = $state<'ready' | 'analyzing'>('ready');
let woNumber = $state('');

export const intakeStatus = {
	get status() {
		return status;
	},
	set status(value: 'ready' | 'analyzing') {
		status = value;
	},
	get woNumber() {
		return woNumber;
	},
	set woNumber(value: string) {
		woNumber = value;
	}
};
