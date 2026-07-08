<script lang="ts">
	import GlassButton from '$lib/glass/GlassButton.svelte';
	import { auth } from '$lib/auth/auth0.svelte';
	import { env } from '$env/dynamic/public';

	const href = $derived.by(() => {
		const base = env.PUBLIC_TICKETAPP_BASE_URL ?? '';
		const params = new URLSearchParams({ source: 'template-app' });
		if (auth?.state?.user?.sub) params.set('user', auth.state.user.sub);
		return `${base}/tickets/new?${params.toString()}`;
	});
</script>

<GlassButton {href} title="Submit a support ticket">
	Submit ticket
</GlassButton>
