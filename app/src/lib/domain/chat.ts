import { env } from '$env/dynamic/public';
import { apiFetch } from '$lib/api/client';
import { getAccessToken, invalidateAuth } from '$lib/auth/auth0.svelte';
import type { ChatMessage, ChatStreamEvent, ChatConversationSummary } from './types';

const baseURL = (env.PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export async function listConversations(analysisId: string): Promise<ChatConversationSummary[]> {
	const res = await apiFetch<{ conversations: ChatConversationSummary[] }>(
		`/api/analyses/${analysisId}/chats`
	);
	return res.conversations;
}

export async function createConversation(analysisId: string): Promise<ChatConversationSummary> {
	return apiFetch<ChatConversationSummary>(`/api/analyses/${analysisId}/chats`, {
		method: 'POST',
		body: {}
	});
}

export async function listMessages(
	analysisId: string,
	conversationId: string
): Promise<ChatMessage[]> {
	const res = await apiFetch<{ messages: ChatMessage[] }>(
		`/api/analyses/${analysisId}/chats/${conversationId}`
	);
	return res.messages;
}

export async function streamChat(
	analysisId: string,
	conversationId: string,
	message: string,
	onEvent: (e: ChatStreamEvent) => void,
	selectedPath?: string[] | null
): Promise<void> {
	const token = await getAccessToken();
	const res = await fetch(`${baseURL}/api/analyses/${analysisId}/chats/${conversationId}/message`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'text/event-stream',
			...(token ? { Authorization: `Bearer ${token}` } : {})
		},
		body: JSON.stringify(
			selectedPath?.length ? { message, selected_path: selectedPath } : { message }
		)
	});
	if (!res.ok || !res.body) {
		if (res.status === 401) invalidateAuth();
		throw new Error(`chat failed: ${res.status}`);
	}
	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const frames = buffer.split('\n\n');
		buffer = frames.pop() ?? '';
		for (const frame of frames) {
			const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
			if (!dataLine) continue;
			try {
				onEvent(JSON.parse(dataLine.slice(5).trim()) as ChatStreamEvent);
			} catch {
				/* ignore malformed frame */
			}
		}
	}
}
