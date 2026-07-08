<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import type { AsyncState } from './asyncState.svelte';

	interface Props {
		state: AsyncState<T>;
		/** Optional empty-check — when the loaded data is "empty," render the empty slot. */
		isEmpty?: (data: T) => boolean;
		loading?: Snippet;
		empty?: Snippet;
		error?: Snippet<[{ message: string; retry?: () => void }]>;
		retry?: () => void;
		children: Snippet<[T]>;
	}

	let {
		state,
		isEmpty,
		loading,
		empty,
		error,
		retry,
		children
	}: Props = $props();
</script>

{#if state.kind === 'idle' || state.kind === 'loading'}
	{#if loading}
		{@render loading()}
	{:else}
		<div class="boundary-default boundary-loading">Loading…</div>
	{/if}
{:else if state.kind === 'error'}
	{#if error}
		{@render error({ message: state.message, retry })}
	{:else}
		<div class="boundary-default boundary-error">
			<p><strong>Couldn't load.</strong></p>
			<p class="muted">{state.message}</p>
			{#if retry}
				<button type="button" onclick={retry} class="boundary-retry">Try again</button>
			{/if}
		</div>
	{/if}
{:else if isEmpty?.(state.data)}
	{#if empty}
		{@render empty()}
	{:else}
		<div class="boundary-default">Nothing here yet.</div>
	{/if}
{:else}
	{@render children(state.data)}
{/if}

<style>
	.boundary-default {
		padding: 1.5rem;
		text-align: center;
		color: var(--color-page-fg-muted);
		font-size: 0.9375rem;
	}
	.boundary-loading {
		opacity: 0.7;
	}
	.boundary-error {
		color: var(--color-priority-critical);
	}
	.boundary-error .muted {
		color: var(--color-page-fg-muted);
		font-size: 0.8125rem;
		margin-top: 0.25rem;
	}
	.boundary-retry {
		margin-top: 0.75rem;
		padding: 0.375rem 1rem;
		border-radius: 999px;
		background: var(--color-glass-tint-strong);
		border: 1px solid var(--color-glass-border);
		color: var(--color-page-fg);
		cursor: pointer;
		font: inherit;
		font-size: 0.875rem;
	}
</style>
