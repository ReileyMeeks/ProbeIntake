import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Page from './+page.svelte';

vi.mock('$lib/api/client', () => ({
	postAnalyze: vi.fn(async () => ({
		probeId: { model: 'C1-6-D', mfg: 'GE Healthcare', sn: 'SN1', ref: 'REF1' },
		findings: [],
		quoteItems: [],
		overallCondition: 'Good',
		confidence: 90,
		notes: ''
	}))
}));

// Intake and Quote are transitioned views (Revisions 2), not side-by-side
// panes — only one is mounted at a time, and the swap runs a fly/fade
// transition. That transition still runs in jsdom (no reduced-motion stub is
// configured, so `window.matchMedia(...).matches` is false), so assertions
// that rely on the previous view being gone use `waitFor`/`findBy*` rather
// than a synchronous query.
describe('intake → quote flow', () => {
	it('renders the intake view by default, with no quote view mounted', () => {
		render(Page);
		expect(screen.getByText(/^intake$/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /analyze probe/i })).toBeInTheDocument();
		expect(screen.queryByText(/^quote$/i)).not.toBeInTheDocument();
	});

	it('switches to the quote view after a successful analyze', async () => {
		render(Page);
		await fireEvent.click(screen.getByRole('button', { name: /analyze probe/i }));

		expect(await screen.findByText(/^quote$/i)).toBeInTheDocument();
		await waitFor(() =>
			expect(screen.queryByRole('button', { name: /analyze probe/i })).not.toBeInTheDocument()
		);
	});

	it('"New intake" returns to the intake view without losing entered data', async () => {
		render(Page);
		const soInput = screen.getByLabelText(/sales order/i) as HTMLInputElement;
		await fireEvent.input(soInput, { target: { value: 'SO-42' } });

		await fireEvent.click(screen.getByRole('button', { name: /analyze probe/i }));
		await screen.findByText(/^quote$/i);

		await fireEvent.click(screen.getByRole('button', { name: /new intake/i }));

		const restoredInput = await screen.findByLabelText(/sales order/i);
		expect(restoredInput).toHaveValue('SO-42');
	});

	it('shows the analyze error and stays on the intake view', async () => {
		const { postAnalyze } = await import('$lib/api/client');
		vi.mocked(postAnalyze).mockRejectedValueOnce(new Error('Analysis failed.'));

		render(Page);
		await fireEvent.click(screen.getByRole('button', { name: /analyze probe/i }));

		expect(await screen.findByRole('alert')).toHaveTextContent(/analysis failed/i);
		expect(screen.getByRole('button', { name: /analyze probe/i })).toBeInTheDocument();
	});
});
