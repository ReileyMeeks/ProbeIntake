import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { CapturedImage } from '$lib/domain/probe';
import CapturePanel from './CapturePanel.svelte';

// NOTE: this file is named `capture.svelte.test.ts` (not `capture.test.ts`)
// on purpose. `CapturePanel` mutates its bound `images` prop in place
// (push/splice/index-assign — see the comment above its $bindable
// declaration), which only notifies the outer variable held here if that
// variable is itself a real `$state` array/proxy (a plain `[]` mutated via
// `.push` from inside the child updates the data but fires no reactive
// signal — verified against this project's Svelte 5 + @testing-library/svelte
// setup). Using `$state` requires this file to go through the Svelte
// compiler in runes mode, which `@sveltejs/vite-plugin-svelte` only does for
// files containing the `.svelte.` infix — `capture.svelte.test.ts` satisfies
// both that and vitest's `*.test.ts` include glob.
describe('capture', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('uploads into the "lens" zone slot and tags the resulting image with that zone', async () => {
		const images = $state<CapturedImage[]>([]);
		render(CapturePanel, { props: { images } });
		const file = new File([new Uint8Array([1, 2, 3])], 'p.jpg', { type: 'image/jpeg' });
		const input = screen.getByTestId('file-input-lens') as HTMLInputElement;
		await fireEvent.change(input, { target: { files: [file] } });
		await waitFor(() => expect(images.length).toBe(1));
		expect(images[0].zone).toBe('lens');
		expect(images[0].mediaType).toBe('image/jpeg');
		expect(images[0].isForm).toBe(false);
	});

	it('produces a non-empty raw base64 payload and a matching data URL thumbnail', async () => {
		// NOTE (jsdom limitation): jsdom's HTMLCanvasElement never implements
		// getContext('2d')/toDataURL (both return null — see downscale.ts), and
		// <img>.onload never fires for a data: URL src, so the real downscale
		// path can't run here. downscaleToJpeg() falls back to the original
		// (un-downscaled) image bytes in that case. This test asserts the
		// observable contract — non-empty raw base64, no `data:` prefix, and a
		// dataUrl usable as an <img src> — not exact pixel dimensions. Real
		// browsers exercise the actual canvas downscale path (see
		// downscale.test.ts for the resize-math unit coverage).
		const images = $state<CapturedImage[]>([]);
		render(CapturePanel, { props: { images } });
		const file = new File([new Uint8Array([1, 2, 3, 4, 5])], 'probe.jpg', { type: 'image/jpeg' });
		const input = screen.getByTestId('file-input-housing') as HTMLInputElement;
		await fireEvent.change(input, { target: { files: [file] } });

		await waitFor(() => expect(images.length).toBe(1));
		const [captured] = images;
		expect(captured.base64.length).toBeGreaterThan(0);
		expect(captured.base64.startsWith('data:')).toBe(false);
		expect(captured.dataUrl).toContain('base64,');
		expect(captured.zone).toBe('housing');
		expect(captured.isForm).toBe(false);
	});

	it('replaces the existing image when a new file is uploaded into an already-filled zone', async () => {
		const images = $state<CapturedImage[]>([]);
		render(CapturePanel, { props: { images } });
		const first = new File([new Uint8Array([1, 2, 3])], 'first.jpg', { type: 'image/jpeg' });
		const input = screen.getByTestId('file-input-cable') as HTMLInputElement;
		await fireEvent.change(input, { target: { files: [first] } });
		await waitFor(() => expect(images.length).toBe(1));

		// Once filled, the zone shows a captured chip with a remove button
		// instead — remove it, then upload again into the same zone.
		await fireEvent.click(screen.getByRole('button', { name: /remove cable image/i }));
		await waitFor(() => expect(images.length).toBe(0));

		const second = new File([new Uint8Array([4, 5, 6])], 'second.jpg', { type: 'image/jpeg' });
		const reUpload = screen.getByTestId('file-input-cable') as HTMLInputElement;
		await fireEvent.change(reUpload, { target: { files: [second] } });
		await waitFor(() => expect(images.length).toBe(1));
		expect(images[0].zone).toBe('cable');
	});

	it('ignores non-image files', async () => {
		const images = $state<CapturedImage[]>([]);
		render(CapturePanel, { props: { images } });
		const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
		const input = screen.getByTestId('file-input-lens') as HTMLInputElement;
		await fireEvent.change(input, { target: { files: [file] } });
		expect(images.length).toBe(0);
	});

	// ── Interactive schematic capture (Revisions 2) ────────────────────────
	// The probe diagram itself is the capture control: each zone segment is a
	// focusable button that opens a file picker scoped to that zone. Since
	// jsdom can't show a real native file dialog, these tests assert the
	// wiring — activating a zone calls `.click()` on that zone's own hidden
	// input — rather than a full pick-a-file round trip (already covered by
	// the direct-input tests above).
	it('clicking a schematic zone opens that zone’s own file picker', async () => {
		const images = $state<CapturedImage[]>([]);
		render(CapturePanel, { props: { images } });
		const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

		const housingZone = screen.getByRole('button', { name: /housing zone/i });
		await fireEvent.click(housingZone);

		const housingInput = screen.getByTestId('file-input-housing') as HTMLInputElement;
		expect(clickSpy.mock.instances).toContain(housingInput);
	});

	it('pressing Enter on a focused schematic zone opens that zone’s file picker', async () => {
		const images = $state<CapturedImage[]>([]);
		render(CapturePanel, { props: { images } });
		const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

		const lensZone = screen.getByRole('button', { name: /lens zone/i });
		lensZone.focus();
		await fireEvent.keyDown(lensZone, { key: 'Enter' });

		const lensInput = screen.getByTestId('file-input-lens') as HTMLInputElement;
		expect(clickSpy.mock.instances).toContain(lensInput);
	});

	it('every probe zone is a keyboard-focusable button on the schematic', () => {
		const images = $state<CapturedImage[]>([]);
		render(CapturePanel, { props: { images } });
		for (const name of [
			/lens zone/i,
			/housing zone/i,
			/strain relief zone/i,
			/cable zone/i,
			/connector zone/i
		]) {
			const zone = screen.getByRole('button', { name });
			expect(zone).toHaveAttribute('tabindex', '0');
		}
	});
});
