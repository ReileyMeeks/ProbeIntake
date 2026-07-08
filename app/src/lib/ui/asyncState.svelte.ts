/**
 * Tiny async-state runner using Svelte 5 runes. Keeps the
 * "load → loading → ok/error" boilerplate out of every page.
 *
 * Usage:
 *   const tickets = $state(asyncRunner(() => api.tickets.list()));
 *   onMount(tickets.run);
 *   {#if tickets.state.kind === 'ok'} ... {/if}
 *
 * `state` is a discriminated union — TS narrows it inside each branch.
 */

export type AsyncState<T> =
	| { kind: 'idle' }
	| { kind: 'loading' }
	| { kind: 'ok'; data: T }
	| { kind: 'error'; message: string };

export function asyncRunner<T>(fetcher: () => Promise<T>) {
	let state = $state<AsyncState<T>>({ kind: 'idle' });
	let inFlight = false;

	async function run() {
		// Re-entrancy guard. Two clicks on Refresh shouldn't stack two
		// fetches racing each other into setState.
		if (inFlight) return;
		inFlight = true;
		state = { kind: 'loading' };
		try {
			const data = await fetcher();
			state = { kind: 'ok', data };
		} catch (err) {
			state = { kind: 'error', message: errorMessage(err) };
		} finally {
			inFlight = false;
		}
	}

	return {
		get state() {
			return state;
		},
		run
	};
}

function errorMessage(err: unknown): string {
	if (err && typeof err === 'object' && 'status' in err && 'url' in err) {
		const e = err as { status: number; url: string };
		return `${e.status} from ${new URL(e.url).pathname}`;
	}
	if (err instanceof Error) return err.message;
	return 'Unknown error';
}
