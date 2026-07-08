<script lang="ts">
	import type { Snippet } from 'svelte';
	import GlassCard from '$lib/glass/GlassCard.svelte';
	import { listConversations, createConversation, listMessages, streamChat } from './chat';
	import { renderMarkdown } from './markdown';
	import type { ChatMessage, ChatConversationSummary } from './types';

	let {
		analysisId,
		drilldown = undefined,
		selectedPath = null
	}: {
		analysisId: string;
		drilldown?: Snippet | undefined;
		selectedPath?: string[] | null;
	} = $props();

	let useSelection = $state(false);

	let open = $state(false);
	let loaded = $state(false);
	let conversations = $state<ChatConversationSummary[]>([]);
	let currentConvId = $state<string | null>(null);
	let messages = $state<ChatMessage[]>([]);
	let showHistory = $state(false);
	let draft = $state('');
	let streaming = $state(false);
	let toolHint = $state<string | null>(null);

	const render = (md: string) => renderMarkdown(md);

	const currentTitle = $derived(
		currentConvId
			? (conversations.find((c) => c.id === currentConvId)?.title ?? 'New chat')
			: 'New chat'
	);

	async function ensureLoaded() {
		if (loaded) return;
		loaded = true;
		try {
			conversations = await listConversations(analysisId);
			if (conversations.length > 0) {
				await switchTo(conversations[0].id);
			}
		} catch {
			conversations = [];
		}
	}

	function toggle() {
		open = !open;
		if (open) ensureLoaded();
	}

	async function switchTo(id: string) {
		currentConvId = id;
		showHistory = false;
		try {
			messages = await listMessages(analysisId, id);
		} catch {
			messages = [];
		}
	}

	function newChat() {
		// Lazily created on first send — avoids empty conversations in the list.
		currentConvId = null;
		messages = [];
		showHistory = false;
	}

	async function refreshConversations() {
		try {
			conversations = await listConversations(analysisId);
		} catch {
			/* keep stale list */
		}
	}

	async function send() {
		const text = draft.trim();
		if (!text || streaming) return;
		draft = '';
		if (!currentConvId) {
			try {
				const conv = await createConversation(analysisId);
				conversations = [conv, ...conversations];
				currentConvId = conv.id;
			} catch {
				return;
			}
		}
		const convId = currentConvId;
		messages = [...messages, { role: 'user', content: text }, { role: 'assistant', content: '' }];
		const idx = messages.length - 1;
		streaming = true;
		toolHint = null;
		try {
			await streamChat(analysisId, convId, text, (e) => {
				if (e.type === 'token') {
					messages[idx].content += e.text;
					messages = [...messages];
				} else if (e.type === 'tool') {
					toolHint = e.name === 'get_findings_for_combo' ? 'Looking up drivers…' : 'Fetching combos…';
				} else if (e.type === 'done') {
					messages[idx].content = e.text || messages[idx].content;
					messages = [...messages];
				} else if (e.type === 'error') {
					messages[idx].content = messages[idx].content || '_Sorry — the chat request failed._';
					messages = [...messages];
				}
			}, useSelection ? selectedPath : null);
		} catch {
			messages[idx].content = messages[idx].content || '_Sorry — the chat request failed._';
			messages = [...messages];
		} finally {
			streaming = false;
			toolHint = null;
			refreshConversations();
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	function fmtConvDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		} catch {
			return '';
		}
	}

	let expanded = $state(false);
	let logEl: HTMLDivElement | undefined = $state();

	// Auto-scroll the log to the newest content as it streams / on send / switch.
	$effect(() => {
		void messages;
		void toolHint;
		if (logEl) logEl.scrollTop = logEl.scrollHeight;
	});
</script>

<div class="chat-dock" class:expanded={expanded}>
	{#if open}
		<GlassCard class="chat-card">
			<div class="chat-layout" class:split={expanded && drilldown}>
				{#if expanded && drilldown}
					<div class="split-left">
						<div class="split-left-body">
							{@render drilldown()}
						</div>
					</div>
				{/if}
				<div class="chat-inner">
					{#if expanded && drilldown}
						<div class="context-bar">
							<label class="sel-toggle">
								<input type="checkbox" bind:checked={useSelection} />
								<span class="switch-track"><span class="switch-thumb"></span></span>
								<span class="switch-label">Ask about selection</span>
							</label>
							<span class="context-path" class:active={useSelection && selectedPath?.length}>
								{#if !useSelection}
									Whole analysis
								{:else if selectedPath?.length}
									{selectedPath.join(' / ')}
								{:else}
									Click a row to choose context →
								{/if}
							</span>
						</div>
					{/if}
					<div class="chat-head">
						<strong class="chat-title">{showHistory ? 'Your chats' : currentTitle}</strong>
						<div class="chat-head-actions">
							<button class="head-btn icon-btn" onclick={newChat} aria-label="New chat" title="New chat">
							<svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
								<path d="M4 20 h4 L19 9 l-4 -4 L4 16 v4 Z M14 6 l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
							</svg>
						</button>
							<button class="head-btn icon-btn" onclick={() => (expanded = !expanded)} aria-label={expanded ? 'Exit full screen' : 'Full screen'} title={expanded ? 'Exit full screen' : 'Full screen'}>
								<svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
									{#if expanded}
										<path d="M10 10 L4 4 M4 8 V4 H8 M14 10 L20 4 M20 8 V4 H16 M10 14 L4 20 M4 16 V20 H8 M14 14 L20 20 M20 16 V20 H16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
									{:else}
										<path d="M4 9 V4 H9 M20 9 V4 H15 M4 15 V20 H9 M20 15 V20 H15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
									{/if}
								</svg>
							</button>
							<button class="head-btn" class:active={showHistory} onclick={() => (showHistory = !showHistory)} aria-label="Chat history" title="Chat history">History</button>
							<button class="close" onclick={toggle} aria-label="Close chat">×</button>
						</div>
					</div>

					{#if showHistory}
						<div class="chat-history">
							{#if conversations.length === 0}
								<p class="hint">No previous chats yet.</p>
							{:else}
								{#each conversations as c (c.id)}
									<button class="history-item" class:current={c.id === currentConvId} onclick={() => switchTo(c.id)}>
										<span class="history-title">{c.title ?? 'New chat'}</span>
										<span class="history-meta">{fmtConvDate(c.created_at)} · {c.message_count} msg{c.message_count === 1 ? '' : 's'}</span>
									</button>
								{/each}
							{/if}
						</div>
					{:else}
						<div class="chat-log" bind:this={logEl}>
							{#each messages as m}
								<div class="msg {m.role}">
									{#if m.role === 'assistant'}
										<div class="prose prose-sm">{@html render(m.content || '…')}</div>
									{:else}
										<p class="user-text">{m.content}</p>
									{/if}
								</div>
							{/each}
							{#if toolHint}<p class="tool-hint">{toolHint}</p>{/if}
							{#if messages.length === 0}<p class="hint">Ask about this analysis…</p>{/if}
						</div>
					{/if}

					{#if !showHistory}
						<div class="chat-input">
							<input
								class="chat-text"
								type="text"
								bind:value={draft}
								placeholder="Ask Cortex…"
								onkeydown={onKeydown}
								disabled={streaming}
							/>
							<button class="send-btn" onclick={send} disabled={streaming || !draft.trim()} aria-label="Send" title="Send">
								<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
									<path d="M12 19 V5 M6 11 l6 -6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
								</svg>
							</button>
						</div>
					{/if}
				</div>
			</div>
		</GlassCard>
	{:else}
		<button class="chat-fab" onclick={toggle} aria-label="Ask Cortex" title="Ask Cortex">
			<svg viewBox="0 0 24 24" width="34" height="34" fill="#fff" aria-hidden="true">
				<g transform="translate(0 2.2)">
					<path d="M10 4 L11.6 8.4 L16 10 L11.6 11.6 L10 16 L8.4 11.6 L4 10 L8.4 8.4 Z"/>
					<path d="M18 3 L18.7 4.8 L20.5 5.5 L18.7 6.2 L18 8 L17.3 6.2 L15.5 5.5 L17.3 4.8 Z" opacity="0.9"/>
				</g>
			</svg>
		</button>
	{/if}
</div>

<style>
	.chat-dock {
		position: fixed;
		right: 1.5rem;
		bottom: 1.5rem;
		z-index: 50;
		width: auto;
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.6rem;
	}
	:global(.chat-card) {
		padding: 0;
		width: min(28rem, calc(100vw - 3rem));
	}
	.chat-inner {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.9rem 1rem;
		max-height: min(70vh, 600px);
	}
	/* Full-screen / expanded view */
	.chat-dock.expanded {
		top: 1.5rem;
		left: 1.5rem;
		right: 1.5rem;
		bottom: 1.5rem;
		align-items: stretch;
	}
	.chat-dock.expanded :global(.chat-card) {
		width: 100%;
		height: 100%;
		/* Solid surface in full-screen so the nested drill-down's glass inputs,
		   toggles and rows don't wash out against the dim backdrop. */
		background: var(--color-card-opaque);
		backdrop-filter: blur(24px) saturate(140%);
		-webkit-backdrop-filter: blur(24px) saturate(140%);
	}
	.chat-dock.expanded .chat-inner {
		max-height: none;
		height: 100%;
	}
	.chat-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.9375rem;
	}
	.close {
		appearance: none;
		border: 0;
		background: transparent;
		color: var(--color-page-fg-muted);
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		transition: color 160ms var(--ease-glass);
	}
	.close:hover {
		color: var(--color-page-fg);
	}
	.chat-log {
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding-right: 0.25rem;
		min-height: 8rem;
		flex: 1 1 auto;
	}
	.msg {
		display: block;
	}
	.msg.user {
		align-self: flex-end;
		background: color-mix(in srgb, var(--color-accent) 16%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
		border-radius: 0.75rem 0.75rem 0.1rem 0.75rem;
		padding: 0.4rem 0.7rem;
		max-width: 85%;
	}
	.msg.assistant {
		align-self: flex-start;
		max-width: 95%;
	}
	.user-text {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.45;
		color: var(--color-page-fg);
	}
	.prose {
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--color-page-fg);
		/* Make Tailwind typography theme-aware so ALL text (body, headings,
		   bold, blockquotes/italics, captions, code, borders) follows the
		   current theme instead of the plugin's fixed near-black defaults. */
		--tw-prose-body: var(--color-page-fg);
		--tw-prose-headings: var(--color-page-fg);
		--tw-prose-bold: var(--color-page-fg);
		--tw-prose-quotes: var(--color-page-fg);
		--tw-prose-quote-borders: color-mix(in srgb, var(--color-page-fg) 25%, transparent);
		--tw-prose-captions: var(--color-page-fg-muted);
		--tw-prose-code: var(--color-page-fg);
		--tw-prose-links: var(--color-accent);
		--tw-prose-bullets: var(--color-page-fg-muted);
		--tw-prose-counters: var(--color-page-fg-muted);
		--tw-prose-hr: color-mix(in srgb, var(--color-page-fg) 18%, transparent);
		--tw-prose-th-borders: color-mix(in srgb, var(--color-page-fg) 25%, transparent);
		--tw-prose-td-borders: color-mix(in srgb, var(--color-page-fg) 18%, transparent);
	}
	.prose :global(blockquote) {
		color: inherit;
		font-style: italic;
		border-left: 3px solid color-mix(in srgb, var(--color-page-fg) 25%, transparent);
		padding-left: 0.75rem;
		margin: 0.5em 0;
	}
	.prose :global(em), .prose :global(i), .prose :global(blockquote strong) { color: inherit; }
	/* Override Tailwind prose defaults to match our glass aesthetic */
	.prose :global(p) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}
	.prose :global(p:first-child) {
		margin-top: 0;
	}
	.prose :global(p:last-child) {
		margin-bottom: 0;
	}
	.prose :global(code) {
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
		border-radius: 0.25rem;
		padding: 0.125rem 0.35rem;
		font-size: 0.8125rem;
	}
	.prose :global(pre) {
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
		border-radius: 0.5rem;
		padding: 0.75rem;
		overflow-x: auto;
		margin: 0.5em 0;
	}
	.prose :global(pre code) {
		background: transparent;
		border: 0;
		padding: 0;
	}
	.prose :global(a) {
		color: var(--color-accent);
		text-decoration: underline;
	}
	.prose :global(ul), .prose :global(ol) {
		margin: 0.5em 0;
		padding-left: 1.5em;
	}
	.prose :global(li) {
		margin: 0.25em 0;
	}
	.prose :global(strong) { color: inherit; font-weight: 600; }
	.prose :global(h1), .prose :global(h2), .prose :global(h3) { color: inherit; }
	.prose :global(table) { width: 100%; border-collapse: collapse; font-size: 0.8125rem; margin: 0.5rem 0; }
	.prose :global(th), .prose :global(td) {
		color: inherit;
		text-align: left;
		padding: 0.3rem 0.5rem;
		border: 1px solid color-mix(in srgb, var(--color-page-fg) 20%, transparent);
	}
	.prose :global(th) { font-weight: 600; background: color-mix(in srgb, var(--color-page-fg) 8%, transparent); }
	.tool-hint {
		font-size: 0.75rem;
		color: var(--color-page-fg-muted);
		font-style: italic;
		margin: 0;
		align-self: flex-start;
	}
	.hint {
		font-size: 0.8125rem;
		color: var(--color-page-fg-muted);
		margin: 0;
		text-align: center;
		padding: 1rem 0;
	}
	.chat-input {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.chat-text {
		flex: 1;
		display: block;
		padding: 0.5rem 0.875rem;
		font: inherit;
		font-size: 0.875rem;
		color: var(--color-page-fg);
		background: var(--color-glass-tint);
		border: 1px solid var(--color-glass-border);
		border-radius: 999px;
		backdrop-filter: blur(12px) saturate(160%);
		-webkit-backdrop-filter: blur(12px) saturate(160%);
		transition: border-color 160ms var(--ease-glass), background-color 160ms var(--ease-glass);
	}
	.chat-text::placeholder {
		color: var(--color-page-fg-muted);
	}
	.chat-text:hover:not(:disabled) {
		border-color: var(--color-glass-border-bright);
	}
	.chat-text:focus {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
	.chat-text:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.send-btn {
		appearance: none; border: 0; cursor: pointer; flex: none;
		width: 2.1rem; height: 2.1rem; border-radius: 999px;
		display: inline-flex; align-items: center; justify-content: center;
		background: #6366F1; color: #fff;
		transition: background 140ms ease, opacity 140ms ease;
	}
	.send-btn:hover:not(:disabled) { background: #5457e5; }
	.send-btn:disabled { opacity: 0.45; cursor: not-allowed; }
	.chat-fab {
		appearance: none;
		border: 0;
		cursor: pointer;
		width: 3.25rem;
		height: 3.25rem;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #6366F1, #A855F7);
		color: #fff;
		box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
		transition: transform 140ms ease, box-shadow 140ms ease;
	}
	.chat-fab:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(99, 102, 241, 0.5); }
	.chat-fab:active { transform: translateY(0); }
	@media (prefers-reduced-transparency: reduce) {
		.chat-text {
			background: var(--color-page-bg);
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}
	}
	.chat-head-actions { display: inline-flex; align-items: center; gap: 0.4rem; }
	.head-btn { appearance: none; border: 1px solid var(--color-glass-border); background: transparent; color: var(--color-page-fg-muted); font: inherit; font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 0.5rem; cursor: pointer; }
	.head-btn.icon-btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.25rem 0.4rem; }
	.head-btn:hover { background: var(--color-glass-tint); color: var(--color-page-fg); }
	.head-btn.active { color: #6366F1; border-color: color-mix(in srgb, #6366F1 45%, transparent); }
	.chat-title { font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 14rem; }
	.chat-history { overflow-y: auto; display: flex; flex-direction: column; gap: 0.3rem; padding-right: 0.25rem; }
	.history-item { appearance: none; border: 1px solid var(--color-glass-border); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; border-radius: 0.6rem; padding: 0.5rem 0.6rem; display: flex; flex-direction: column; gap: 0.15rem; }
	.history-item:hover { background: var(--color-glass-tint); }
	.history-item.current { border-color: color-mix(in srgb, #6366F1 45%, transparent); background: color-mix(in srgb, #6366F1 10%, transparent); }
	.history-title { font-size: 0.8125rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.history-meta { font-size: 0.7rem; color: var(--color-page-fg-muted); }
	.chat-layout { display: flex; flex-direction: column; height: 100%; }
	.chat-layout.split { flex-direction: row; gap: 0.75rem; }
	.split-left { flex: 1 1 50%; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--color-glass-border); overflow: hidden; }
	.split-left-body { overflow: auto; flex: 1 1 auto; }
	.chat-layout.split .chat-inner { flex: 1 1 50%; min-width: 0; }
	/* Context bar lives in the chat pane so the user can see exactly what the
	   chat is scoped to (the selected drill path, or the whole analysis). */
	.context-bar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; padding-bottom: 0.5rem; margin-bottom: 0.2rem; border-bottom: 1px solid var(--color-glass-border); }
	.context-path { font-size: 0.75rem; color: var(--color-page-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
	.context-path.active { color: var(--color-accent); font-weight: 500; }
	/* "Ask about selection" toggle — matches the switch used in the filter bar. */
	.sel-toggle { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.75rem; color: var(--color-page-fg-muted); cursor: pointer; }
	.sel-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
	.sel-toggle .switch-track { position: relative; width: 2rem; height: 1.1rem; border-radius: 999px; background: color-mix(in srgb, var(--color-page-fg) 30%, transparent); transition: background 140ms ease; flex: none; }
	.sel-toggle .switch-thumb { position: absolute; top: 50%; left: 0.15rem; transform: translateY(-50%); width: 0.8rem; height: 0.8rem; border-radius: 999px; background: #fff; transition: left 140ms ease; }
	.sel-toggle input:checked + .switch-track { background: var(--color-accent); }
	.sel-toggle input:checked + .switch-track .switch-thumb { left: calc(100% - 0.95rem); }
	.sel-toggle input:focus-visible + .switch-track { outline: 2px solid var(--color-accent); outline-offset: 2px; }
</style>
