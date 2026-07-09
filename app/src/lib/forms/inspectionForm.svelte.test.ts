import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import type { CapturedImage } from '$lib/domain/probe';
import InspectionForm from './InspectionForm.svelte';

// NOTE: `.svelte.` infix — see the comment in capture.svelte.test.ts; the
// same reasoning applies: `images` must be a real `$state` array for this
// file's assertions to observe InspectionForm's in-place mutations.
//
// PDF rendering itself is NOT exercised here: pdf.js renders each page onto
// a `<canvas>`, and jsdom's HTMLCanvasElement never implements
// getContext('2d')/toDataURL (both return null), so there's no way to drive
// the real page-render path under vitest. That path was verified directly
// against the repo's `FormImages/WO0341463 IVIF.pdf` fixture via a one-off
// Node script using pdfjs-dist's legacy Node build + @napi-rs/canvas, which
// rendered both of the fixture's pages to real JPEG bytes, and again via a
// manual check against the running dev server. What's covered here is the
// non-canvas contract: the image-upload path (same downscale fallback as
// CapturePanel) and the file-type filtering that gates which files reach
// the PDF path at all.
describe('InspectionForm', () => {
	it('uploads an image directly as an isForm CapturedImage', async () => {
		const images = $state<CapturedImage[]>([]);
		render(InspectionForm, { props: { images } });
		const file = new File([new Uint8Array([1, 2, 3])], 'evalform.jpg', { type: 'image/jpeg' });
		const input = screen.getByTestId('file-input-form') as HTMLInputElement;
		await fireEvent.change(input, { target: { files: [file] } });

		await waitFor(() => expect(images.length).toBe(1));
		expect(images[0].isForm).toBe(true);
		expect(images[0].zone).toBe('form');
		expect(images[0].mediaType).toBe('image/jpeg');
		expect(images[0].base64.length).toBeGreaterThan(0);
	});

	it('ignores files that are neither PDF nor image', async () => {
		const images = $state<CapturedImage[]>([]);
		render(InspectionForm, { props: { images } });
		const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
		const input = screen.getByTestId('file-input-form') as HTMLInputElement;
		await fireEvent.change(input, { target: { files: [file] } });

		expect(images.length).toBe(0);
	});

	it('removing a form page removes only that image', async () => {
		const images = $state<CapturedImage[]>([]);
		render(InspectionForm, { props: { images } });
		const first = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' });
		const second = new File([new Uint8Array([2])], 'b.jpg', { type: 'image/jpeg' });
		const input = screen.getByTestId('file-input-form') as HTMLInputElement;

		await fireEvent.change(input, { target: { files: [first] } });
		await waitFor(() => expect(images.length).toBe(1));
		await fireEvent.change(input, { target: { files: [second] } });
		await waitFor(() => expect(images.length).toBe(2));

		const [removeFirst] = screen.getAllByRole('button', { name: /remove inspection form page/i });
		await fireEvent.click(removeFirst);
		await waitFor(() => expect(images.length).toBe(1));
	});
});
