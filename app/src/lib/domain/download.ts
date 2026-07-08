import { env } from '$env/dynamic/public';
import { getAccessToken } from '$lib/auth/auth0.svelte';

export async function downloadAuthed(path: string, filename: string): Promise<void> {
	const base = (env.PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
	const token = await getAccessToken();
	const headers: Record<string, string> = {};
	if (token) headers.Authorization = `Bearer ${token}`;
	const res = await fetch(`${base}${path}`, { method: 'POST', headers });
	if (!res.ok) throw new Error(`export failed: ${res.status}`);
	const blob = await res.blob();
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
