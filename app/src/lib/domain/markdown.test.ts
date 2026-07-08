import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('renders basic markdown formatting', () => {
		const html = renderMarkdown('**bold** and a list:\n- one\n- two');
		expect(html).toContain('<strong>bold</strong>');
		expect(html).toContain('<li>one</li>');
	});

	it('strips script tags (stored XSS via reflected upload data)', () => {
		const html = renderMarkdown('Item: <script>alert(1)</script> done');
		expect(html).not.toContain('<script');
		expect(html.toLowerCase()).not.toContain('alert(1)');
	});

	it('strips inline event handlers', () => {
		const html = renderMarkdown('<img src=x onerror="alert(1)">');
		expect(html.toLowerCase()).not.toContain('onerror');
	});

	it('neutralizes javascript: links', () => {
		const html = renderMarkdown('[click](javascript:alert(1))');
		expect(html.toLowerCase()).not.toContain('javascript:alert');
	});
});
