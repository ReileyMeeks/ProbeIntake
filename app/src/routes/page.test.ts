import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Page from './+page.svelte';

describe('intake home', () => {
	it('renders the app title', () => {
		render(Page);
		expect(screen.getByText(/Avante Probe Intake/i)).toBeInTheDocument();
	});
});
