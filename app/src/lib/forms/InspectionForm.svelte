<script lang="ts">
	/**
	 * Dedicated "Inspection form" upload — separate from the probe zones
	 * (Revisions 2, 2026-07-09). Accepts PDF and image files:
	 *  - PDF: each page is rendered client-side via `pdfjs-dist` to a
	 *    downscaled JPEG and added as an `isForm:true` `CapturedImage`
	 *    (so the model reads the form as images — no backend change).
	 *  - Image: added directly as `isForm:true`.
	 * See "Inspection-form section (PDF)" in
	 * docs/superpowers/specs/2026-07-09-bench-instrument-design.md.
	 */
	import type { CapturedImage } from '$lib/domain/probe';
	import { downscaleToJpeg, MAX_DIMENSION, JPEG_QUALITY } from './downscale';
	import { fileToDataUrl, loadImageElement } from './imageFile';
	// Vite `?url` import resolves to the built worker asset's URL at both dev
	// and build time — the standard way to wire a pdf.js worker under Vite.
	import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
	import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

	GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

	let { images = $bindable<CapturedImage[]>([]) }: { images?: CapturedImage[] } = $props();

	let dragging = $state(false);
	let processing = $state(false);
	let errorMessage = $state('');
	let fileInput: HTMLInputElement | undefined = $state();

	const formImages = $derived(images.filter((img) => img.isForm));

	function pushFormImage(mediaType: string, base64: string, dataUrl: string) {
		images.push({ mediaType, base64, dataUrl, isForm: true, zone: 'form' });
	}

	async function addImageFile(file: File) {
		const originalDataUrl = await fileToDataUrl(file);
		const imgEl = await loadImageElement(originalDataUrl);
		const width = imgEl?.naturalWidth || 0;
		const height = imgEl?.naturalHeight || 0;
		const downscaled = downscaleToJpeg(imgEl, width, height, originalDataUrl);
		pushFormImage(downscaled.mediaType, downscaled.base64, downscaled.dataUrl);
	}

	/** Renders every page of `file` to a downscaled JPEG and adds each as a form image. */
	async function addPdfFile(file: File) {
		const buffer = await file.arrayBuffer();
		const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
		try {
			for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
				const page = await pdf.getPage(pageNum);
				const baseViewport = page.getViewport({ scale: 1 });
				const scale = MAX_DIMENSION / Math.max(baseViewport.width, baseViewport.height);
				const viewport = page.getViewport({ scale });
				const canvas = document.createElement('canvas');
				canvas.width = Math.ceil(viewport.width);
				canvas.height = Math.ceil(viewport.height);
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					// jsdom (and any canvas-less environment) can't render pdf.js
					// pages — see capture.svelte.test.ts / InspectionForm's test
					// file for the jsdom-limitation note. There's no image bytes
					// to fall back to for a PDF page, so this page is skipped
					// rather than pushing a broken entry.
					continue;
				}
				await page.render({ canvas, viewport }).promise;
				const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
				const base64 = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : '';
				pushFormImage('image/jpeg', base64, dataUrl);
			}
		} finally {
			await pdf.loadingTask.destroy();
		}
	}

	async function handleFiles(files: Iterable<File>) {
		errorMessage = '';
		processing = true;
		try {
			for (const file of files) {
				if (file.type === 'application/pdf') {
					await addPdfFile(file);
				} else if (file.type.startsWith('image/')) {
					await addImageFile(file);
				}
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Could not read the inspection form.';
		} finally {
			processing = false;
		}
	}

	async function onFilePick(e: Event) {
		const input = e.target as HTMLInputElement;
		// Snapshot into a real array before clearing `input.value` — clearing
		// it resets the input's live FileList in place, which would silently
		// empty out this same reference if we held onto the FileList itself
		// instead of copying its entries first.
		const files = input.files ? Array.from(input.files) : [];
		input.value = '';
		if (files.length) await handleFiles(files);
	}

	async function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const files = e.dataTransfer?.files;
		if (files?.length) await handleFiles(files);
	}

	function removeFormImage(img: CapturedImage) {
		const idx = images.indexOf(img);
		if (idx !== -1) images.splice(idx, 1);
	}
</script>

<div class="inspection-form">
	<h2 class="eyebrow">Inspection form</h2>
	<p class="upload-hint">Drop the eval form (PDF or photo) here, or browse to upload.</p>

	{#if errorMessage}
		<p class="error-line" role="alert">{errorMessage}</p>
	{/if}

	<label
		class="dropzone"
		class:over={dragging}
		for="form-file-input"
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={onDrop}
	>
		<input
			id="form-file-input"
			bind:this={fileInput}
			data-testid="file-input-form"
			type="file"
			accept="application/pdf,image/*"
			multiple
			onchange={onFilePick}
		/>
		<span class="dropzone-label">
			{processing ? 'Processing…' : 'Drop PDF or image, or click to browse'}
		</span>
	</label>

	{#if formImages.length}
		<div class="form-thumbs">
			{#each formImages as img (img)}
				<div class="form-thumb">
					<img src={img.dataUrl} alt="Inspection form page" />
					<button
						type="button"
						class="thumb-rm"
						aria-label="Remove inspection form page"
						onclick={() => removeFormImage(img)}>×</button
					>
				</div>
			{/each}
		</div>
	{/if}

	<div class="status-line mono">
		{#if formImages.length}
			<span class="cap-dot ready" aria-hidden="true"></span>
			{formImages.length} page{formImages.length !== 1 ? 's' : ''} captured
		{:else}
			<span class="cap-dot" aria-hidden="true"></span>
			No inspection form uploaded
		{/if}
	</div>
</div>

<style>
	.inspection-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.upload-hint {
		font-size: 12px;
		color: var(--ink-2);
	}

	.dropzone {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 64px;
		border: 1.5px dashed var(--line-2);
		border-radius: var(--r);
		background: var(--surface-2);
		cursor: pointer;
		position: relative;
		padding: 12px 16px;
		text-align: center;
		transition: all 0.15s;
	}
	.dropzone:hover,
	.dropzone.over {
		border-color: var(--accent);
		background: var(--accent-wash);
	}
	.dropzone input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
		height: 100%;
	}
	.dropzone-label {
		font-size: 12px;
		color: var(--ink-2);
	}

	.form-thumbs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
		gap: 8px;
	}
	.form-thumb {
		aspect-ratio: 3 / 4;
		border-radius: var(--r-sm);
		overflow: hidden;
		border: 1px solid var(--line);
		position: relative;
		background: var(--surface-2);
	}
	.form-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.thumb-rm {
		position: absolute;
		top: 3px;
		right: 3px;
		width: 16px;
		height: 16px;
		background: rgba(14, 22, 38, 0.65);
		border: none;
		border-radius: 50%;
		color: #fff;
		font-size: 11px;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.thumb-rm:hover {
		background: var(--ink);
	}

	.status-line {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--ink-3);
	}
	.cap-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ink-3);
		flex-shrink: 0;
	}
	.cap-dot.ready {
		background: var(--sev-pass);
	}
</style>
