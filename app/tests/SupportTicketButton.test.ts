import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';

// Mock $env/dynamic/public before importing the component
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_TICKETAPP_BASE_URL: 'https://tickets.example.com'
	}
}));

// Mock the auth module — provide a minimal reactive-like object
vi.mock('$lib/auth/auth0.svelte', () => ({
	auth: {
		state: {
			loading: false,
			isAuthenticated: true,
			user: { sub: 'auth0|user123' },
			error: null,
			pendingReturnTo: null
		}
	}
}));

// Must import after mocks are declared (vi.mock is hoisted, but the
// static import of the .svelte file triggers module resolution).
import SupportTicketButton from '$lib/domain/SupportTicketButton.svelte';

describe('SupportTicketButton', () => {
	it('renders a link with the correct href including source and user params', () => {
		render(SupportTicketButton);

		const link = screen.getByText('Submit ticket');
		expect(link).toBeInTheDocument();
		expect(link.tagName).toBe('A');

		const href = link.getAttribute('href');
		expect(href).toContain('https://tickets.example.com/tickets/new?');
		expect(href).toContain('source=margintrace');
		expect(href).toContain('user=auth0%7Cuser123');
	});

	it('includes analysis_id when analysisId prop is provided', () => {
		render(SupportTicketButton, { props: { analysisId: 'abc-999' } });

		const link = screen.getByText('Submit ticket');
		const href = link.getAttribute('href');
		expect(href).toContain('analysis_id=abc-999');
	});

	it('omits analysis_id when analysisId is null', () => {
		render(SupportTicketButton, { props: { analysisId: null } });

		const link = screen.getByText('Submit ticket');
		const href = link.getAttribute('href');
		expect(href).not.toContain('analysis_id');
	});
});
