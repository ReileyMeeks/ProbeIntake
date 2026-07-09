import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Page from './+page.svelte';

describe('intake home', () => {
	it('renders the two-pane intake/quote workspace', () => {
		render(Page);
		expect(screen.getByText(/^intake$/i)).toBeInTheDocument();
		expect(screen.getByText(/^quote$/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /analyze probe/i })).toBeInTheDocument();
	});

	it('shows the empty state until a result exists', () => {
		render(Page);
		expect(screen.getByText(/run analysis to generate a repair quote/i)).toBeInTheDocument();
	});
});
