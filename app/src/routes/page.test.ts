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
	})),
	postEmail: vi.fn(async () => undefined),
	extractForm: vi.fn(async () => ({}))
}));

// The email/export flow dynamically imports `$lib/ui/report` (jsPDF) so it
// doesn't bloat the main page chunk (see +page.svelte's exportPdf comment).
// Stub it here — these tests only need to assert the wiring into `postEmail`,
// not real PDF bytes.
vi.mock('$lib/ui/report', () => ({
	buildReportPdf: vi.fn(() => ({})),
	pdfBase64: vi.fn(() => 'ZmFrZS1wZGY=')
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

describe('quote view → email report', () => {
	async function renderQuoteView() {
		render(Page);
		await fireEvent.click(screen.getByRole('button', { name: /analyze probe/i }));
		await screen.findByText(/^quote$/i);
	}

	it('sends the report and shows "Sent" on success', async () => {
		const { postEmail } = await import('$lib/api/client');

		await renderQuoteView();

		await fireEvent.input(screen.getByLabelText(/recipient email/i), {
			target: { value: 'shop@example.com' }
		});
		await fireEvent.click(screen.getByRole('button', { name: /email report/i }));

		await waitFor(() => expect(postEmail).toHaveBeenCalledTimes(1));
		expect(postEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'shop@example.com',
				subject: expect.any(String),
				summary: expect.any(String),
				pdfBase64: expect.any(String)
			})
		);

		expect(await screen.findByText(/^sent$/i)).toBeInTheDocument();
	});

	it('shows an error and stays sendable when postEmail fails', async () => {
		const { postEmail } = await import('$lib/api/client');
		vi.mocked(postEmail).mockRejectedValueOnce(new Error('Email failed — try again.'));

		await renderQuoteView();

		await fireEvent.input(screen.getByLabelText(/recipient email/i), {
			target: { value: 'shop@example.com' }
		});
		await fireEvent.click(screen.getByRole('button', { name: /email report/i }));

		expect(await screen.findByRole('alert')).toHaveTextContent(/email failed/i);
		expect(screen.getByRole('button', { name: /email report/i })).toBeInTheDocument();
	});
});

describe('intake → form auto-prefill', () => {
	it('shows a pending note while extracting, then prefills empty fields without clobbering typed input', async () => {
		const { extractForm } = await import('$lib/api/client');
		vi.mocked(extractForm).mockClear();
		// A deferred promise, so the "Reading form…" pending state is
		// observable instead of racing a same-tick resolution.
		let resolveExtract!: (fields: Record<string, string>) => void;
		vi.mocked(extractForm).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveExtract = resolve;
				})
		);

		render(Page);

		const modelInput = screen.getByLabelText(/^model$/i) as HTMLInputElement;
		await fireEvent.input(modelInput, { target: { value: 'Already typed' } });

		const fileInput = screen.getByTestId('file-input-form') as HTMLInputElement;
		const file = new File([new Uint8Array([1, 2, 3])], 'evalform.jpg', { type: 'image/jpeg' });
		await fireEvent.change(fileInput, { target: { files: [file] } });

		expect(await screen.findByText(/reading form/i)).toBeInTheDocument();

		resolveExtract({ model: 'C1-6-D', sn: '250840YP6', customer: 'Acme Imaging' });
		await screen.findByText(/prefilled from form/i);

		expect(modelInput.value).toBe('Already typed'); // not clobbered
		expect((screen.getByLabelText(/serial number/i) as HTMLInputElement).value).toBe('250840YP6');
		expect((screen.getByLabelText(/^customer$/i) as HTMLInputElement).value).toBe('Acme Imaging');
		expect(extractForm).toHaveBeenCalledTimes(1);
	});

	it('does not re-run extraction for the same set of form images', async () => {
		const { extractForm } = await import('$lib/api/client');
		vi.mocked(extractForm).mockClear();
		vi.mocked(extractForm).mockResolvedValue({ model: 'C1-6-D' });

		render(Page);

		const fileInput = screen.getByTestId('file-input-form') as HTMLInputElement;
		const file = new File([new Uint8Array([1, 2, 3])], 'evalform.jpg', { type: 'image/jpeg' });
		await fireEvent.change(fileInput, { target: { files: [file] } });

		await waitFor(() => expect(extractForm).toHaveBeenCalledTimes(1));
		await screen.findByText(/prefilled from form/i);

		// Re-typing an unrelated field must not re-trigger extraction.
		await fireEvent.input(screen.getByLabelText(/sales order/i), { target: { value: 'SO-1' } });
		await new Promise((r) => setTimeout(r, 0));
		expect(extractForm).toHaveBeenCalledTimes(1);
	});
});
