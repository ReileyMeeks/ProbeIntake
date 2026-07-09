<script lang="ts">
	import { login } from '$lib/api/client';

	let password = $state('');
	let error = $state('');
	let submitting = $state(false);

	async function submit(e: Event) {
		e.preventDefault();
		submitting = true;
		try {
			if (await login(password)) {
				location.href = '/';
			} else {
				error = 'Incorrect password.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in — Avante Probe Intake</title>
</svelte:head>

<div class="login-page">
	<form class="login-card card" onsubmit={submit}>
		<p class="login-word mono">avante · probe intake</p>
		<p class="login-sub">Enter the shared password to continue.</p>

		<label class="label" for="pw">Password</label>
		<input
			class="inp"
			id="pw"
			name="password"
			type="password"
			autocomplete="current-password"
			bind:value={password}
			required
		/>

		<button class="btn btn-primary" type="submit" disabled={submitting}>
			{submitting ? 'Signing in…' : 'Sign in'}
		</button>

		{#if error}<p class="error-line" role="alert">{error}</p>{/if}
	</form>
</div>

<style>
	.login-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		background: var(--bg);
	}
	.login-card {
		width: 100%;
		max-width: 320px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 26px 24px;
	}
	.login-word {
		font-size: 13px;
		font-weight: 600;
		color: var(--ink);
		margin-bottom: 2px;
	}
	.login-sub {
		font-size: 12px;
		color: var(--ink-2);
		margin-bottom: 10px;
	}
</style>
