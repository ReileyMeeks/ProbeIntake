<script lang="ts">
	import { auth } from '$lib/auth/auth0.svelte';
	import { goto } from '$app/navigation';

	$effect(() => {
		if (auth.state.loading) return;
		const dest = auth.state.pendingReturnTo ?? '/analyses';
		goto(dest, { replaceState: true });
	});
</script>

<p>Signing in…</p>
