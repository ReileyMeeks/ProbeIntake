import { getMe } from './api';
import type { Me } from './types';

const state = $state<{ me: Me | null; loading: boolean; error: string | null }>({
	me: null,
	loading: false,
	error: null
});

let loaded = false;

export async function loadMe(): Promise<void> {
	if (loaded || state.loading) return;
	state.loading = true;
	state.error = null;
	try {
		state.me = await getMe();
		loaded = true;
	} catch (e) {
		state.error = e instanceof Error ? e.message : String(e);
	} finally {
		state.loading = false;
	}
}

export const meStore = {
	get me() {
		return state.me;
	},
	get role() {
		return state.me?.role ?? null;
	}
};
