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
				error = 'Incorrect password';
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
	<form class="login-card" onsubmit={submit}>
		<h1 class="login-title">Avante Probe Intake</h1>
		<p class="login-sub">Enter the shared password to continue.</p>

		<label class="login-label" for="pw">Password</label>
		<input
			class="login-input"
			id="pw"
			name="password"
			type="password"
			autocomplete="current-password"
			bind:value={password}
			required
		/>

		<button class="login-btn" type="submit" disabled={submitting}>
			{submitting ? 'Signing in…' : 'Sign in'}
		</button>

		{#if error}<p class="login-error" role="alert">{error}</p>{/if}
	</form>
</div>

<style>
	.login-page {
		min-height: calc(100vh - 94px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		background: var(--s1);
	}
	.login-card {
		width: 100%;
		max-width: 320px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		background: var(--s2);
		border: 1px solid var(--b1);
		border-radius: 14px;
		padding: 24px 22px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}
	.login-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--navy);
		margin-bottom: 2px;
	}
	.login-sub {
		font-size: 12px;
		color: var(--t3);
		margin-bottom: 10px;
	}
	.login-label {
		font-size: 9px;
		font-weight: 700;
		color: var(--t3);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.login-input {
		height: 34px;
		padding: 0 10px;
		border: 1px solid var(--b2);
		border-radius: 7px;
		font-size: 12px;
		color: var(--t1);
		background: var(--s2);
		outline: none;
		font-family: inherit;
	}
	.login-input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}
	.login-btn {
		height: 38px;
		margin-top: 6px;
		background: var(--navy);
		color: #fff;
		border: none;
		border-radius: 9px;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s;
	}
	.login-btn:hover:not(:disabled) {
		background: var(--navy3);
	}
	.login-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.login-error {
		font-size: 11px;
		color: var(--red);
		margin-top: 2px;
	}
</style>
