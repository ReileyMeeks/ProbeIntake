import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ breaks: true });

/**
 * Render markdown (e.g. LLM output) to HTML that is safe to inject via `{@html}`.
 *
 * `marked` passes raw HTML through unchanged and does not neutralize
 * `javascript:` URLs, so its output MUST be sanitized before injection — the
 * markdown source is influenced by user-uploaded data (customer/item/description
 * text reflected through Claude), which is a stored-XSS vector.
 */
export function renderMarkdown(md: string): string {
	const html = marked.parse(md ?? '', { async: false }) as string;
	// DOMPurify needs a DOM. These views only render client-side, but guard the
	// SSG prerender path by falling back to a tag-stripped plain-text rendering.
	if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, '');
	return DOMPurify.sanitize(html);
}
