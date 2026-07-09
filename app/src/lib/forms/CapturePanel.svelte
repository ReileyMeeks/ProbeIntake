<script lang="ts">
	import type { CapturedImage } from '$lib/domain/probe';
	import { downscaleToJpeg } from './downscale';
	import { onDestroy } from 'svelte';

	interface Zone {
		id: string;
		label: string;
		isForm: boolean;
	}

	/**
	 * Per-zone upload slots — one per canonical probe zone plus the eval-form
	 * slot. Each slot owns its own `<input type=file>`; the camera (when
	 * active) captures into whichever zone is selected. See "Per-zone file
	 * upload" in docs/superpowers/specs/2026-07-09-bench-instrument-design.md.
	 */
	const ZONES: Zone[] = [
		{ id: 'lens', label: 'Lens', isForm: false },
		{ id: 'housing', label: 'Housing', isForm: false },
		{ id: 'strain', label: 'Strain relief', isForm: false },
		{ id: 'cable', label: 'Cable', isForm: false },
		{ id: 'connector', label: 'Connector', isForm: false },
		{ id: 'form', label: 'Eval form', isForm: true }
	];

	// jsdom never fires <img>.onload/.onerror for a `data:` URL src (images
	// aren't actually decoded there), so decode is raced against this timeout
	// as a test-environment escape hatch. Real browsers decode even large
	// photos in a handful of ms, so this only ever fires in a test/headless
	// environment — production always resolves via `onload` first.
	const DECODE_TIMEOUT_MS = 200;

	// Mutated in place (push/splice/index-assign) throughout this file rather
	// than reassigned — that's what makes a caller's own `$state` array (see
	// capture.svelte.test.ts) observe the change directly, since it's the same
	// underlying array/proxy rather than a new one only the child holds.
	let { images = $bindable<CapturedImage[]>([]) }: { images?: CapturedImage[] } = $props();

	let draggingZoneId: string | null = $state(null);
	let activeZoneId = $state(ZONES[0].id);

	// ── Camera state ──────────────────────────────────────────────────────
	const cameraSupported =
		typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
	let cameraActive = $state(false);
	let cameraError: string | null = $state(null);
	let videoEl: HTMLVideoElement | undefined = $state();
	let devices: MediaDeviceInfo[] = $state([]);
	let selectedDeviceId: string | undefined = $state(undefined);
	let flashing = $state(false);
	let stream: MediaStream | null = null;

	const activeZoneLabel = $derived(ZONES.find((z) => z.id === activeZoneId)?.label ?? 'Capture');

	function imageForZone(zoneId: string): CapturedImage | undefined {
		return images.find((img) => img.zone === zoneId);
	}

	function firstEmptyZoneId(): string | undefined {
		return ZONES.find((z) => !imageForZone(z.id))?.id;
	}

	// ── File → base64 helpers ─────────────────────────────────────────────
	function fileToDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
			reader.readAsDataURL(file);
		});
	}

	/** Resolves with a loaded `<img>`, or `null` if decode errors or times out. */
	function loadImageElement(
		src: string,
		timeoutMs = DECODE_TIMEOUT_MS
	): Promise<HTMLImageElement | null> {
		return new Promise((resolve) => {
			let settled = false;
			const finish = (result: HTMLImageElement | null) => {
				if (settled) return;
				settled = true;
				resolve(result);
			};
			const img = new Image();
			img.onload = () => finish(img);
			img.onerror = () => finish(null);
			img.src = src;
			setTimeout(() => finish(null), timeoutMs);
		});
	}

	/** Downscales `source` and writes the result into `zone`'s slot (replacing any existing image there). */
	async function setZoneImage(
		zone: Zone,
		source: CanvasImageSource | null,
		width: number,
		height: number,
		fallbackDataUrl: string
	) {
		const downscaled = downscaleToJpeg(source, width, height, fallbackDataUrl);
		const entry: CapturedImage = {
			mediaType: downscaled.mediaType,
			base64: downscaled.base64,
			dataUrl: downscaled.dataUrl,
			isForm: zone.isForm,
			zone: zone.id
		};
		const idx = images.findIndex((img) => img.zone === zone.id);
		if (idx === -1) images.push(entry);
		else images[idx] = entry;
	}

	async function handleZoneFile(file: File, zone: Zone) {
		if (!file.type.startsWith('image/')) return;
		const originalDataUrl = await fileToDataUrl(file);
		const imgEl = await loadImageElement(originalDataUrl);
		const width = imgEl?.naturalWidth || 0;
		const height = imgEl?.naturalHeight || 0;
		await setZoneImage(zone, imgEl, width, height, originalDataUrl);
	}

	async function onZoneFilePick(e: Event, zone: Zone) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		await handleZoneFile(file, zone);
	}

	async function onZoneDrop(e: DragEvent, zone: Zone) {
		e.preventDefault();
		draggingZoneId = null;
		const file = e.dataTransfer?.files?.[0];
		if (file) await handleZoneFile(file, zone);
	}

	function removeZoneImage(zoneId: string) {
		const idx = images.findIndex((img) => img.zone === zoneId);
		if (idx !== -1) images.splice(idx, 1);
	}

	// ── Camera ────────────────────────────────────────────────────────────
	async function openStream(deviceId?: string) {
		stream?.getTracks().forEach((t) => t.stop());
		const constraints: MediaStreamConstraints = {
			video: deviceId
				? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
				: true
		};
		stream = await navigator.mediaDevices.getUserMedia(constraints);
		selectedDeviceId = deviceId;
		if (videoEl) videoEl.srcObject = stream;
	}

	async function startCamera() {
		if (!cameraSupported) {
			cameraError = 'Camera not supported in this browser.';
			return;
		}
		try {
			const enumerated = await navigator.mediaDevices.enumerateDevices();
			devices = enumerated.filter((d) => d.kind === 'videoinput');
			await openStream(devices[0]?.deviceId);
			cameraActive = true;
			cameraError = null;
			activeZoneId = firstEmptyZoneId() ?? ZONES[0].id;
		} catch (err) {
			cameraError = err instanceof Error ? err.message : 'Camera access denied.';
		}
	}

	async function switchCamera(e: Event) {
		const id = (e.target as HTMLSelectElement).value;
		try {
			await openStream(id);
		} catch (err) {
			cameraError = err instanceof Error ? err.message : 'Could not switch camera.';
		}
	}

	function stopCamera() {
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		cameraActive = false;
		if (videoEl) videoEl.srcObject = null;
	}

	async function captureShot() {
		if (!videoEl?.srcObject) return;
		const zone = ZONES.find((z) => z.id === activeZoneId);
		if (!zone) return;
		flashing = true;
		setTimeout(() => (flashing = false), 350);
		const width = videoEl.videoWidth || 0;
		const height = videoEl.videoHeight || 0;
		await setZoneImage(zone, videoEl, width, height, '');
		activeZoneId = firstEmptyZoneId() ?? zone.id;
	}

	onDestroy(() => {
		stream?.getTracks().forEach((t) => t.stop());
	});
</script>

<div class="capture">
	<div class="capture-hdr">
		<h2 class="eyebrow">Capture</h2>
		{#if cameraSupported && !cameraActive}
			<button type="button" class="btn-sm" onclick={startCamera}>Start camera</button>
		{:else if cameraActive}
			<button type="button" class="btn-sm" onclick={stopCamera}>Stop camera</button>
		{/if}
	</div>

	{#if cameraError}
		<p class="error-line" role="alert">{cameraError}</p>
	{/if}

	{#if cameraActive}
		<div class="cam-ui">
			<div class="cam-select-row">
				<label class="label" for="cam-sel">Camera</label>
				<select id="cam-sel" class="inp" value={selectedDeviceId} onchange={switchCamera}>
					{#each devices as d, i (d.deviceId)}
						<option value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
					{/each}
				</select>
			</div>

			<div class="cam-select-row">
				<label class="label" for="zone-sel">Capturing</label>
				<select id="zone-sel" class="inp" bind:value={activeZoneId}>
					{#each ZONES as zone (zone.id)}
						<option value={zone.id}>{zone.label}{imageForZone(zone.id) ? ' ✓' : ''}</option>
					{/each}
				</select>
			</div>

			<div class="cam-live">
				<!-- svelte-ignore a11y_media_has_caption -->
				<video bind:this={videoEl} autoplay playsinline muted></video>
				<div class="cam-zone-badge mono">{activeZoneLabel}</div>
				<div class="cam-flash" class:on={flashing}></div>
			</div>

			<div class="cam-controls">
				<button type="button" class="btn btn-primary" onclick={captureShot}>Capture</button>
				<button type="button" class="btn btn-secondary" onclick={stopCamera}>Done</button>
			</div>
		</div>
	{/if}

	<p class="upload-hint">Drop probe photos or use the camera. Tag each by zone.</p>

	<div class="zone-grid">
		{#each ZONES as zone (zone.id)}
			{@const img = imageForZone(zone.id)}
			<div class="zone-slot" class:filled={!!img}>
				{#if img}
					<div class="zone-thumb">
						<img src={img.dataUrl} alt="{zone.label} capture" />
						<button
							type="button"
							class="thumb-rm"
							aria-label="Remove {zone.label} image"
							onclick={() => removeZoneImage(zone.id)}>×</button
						>
					</div>
				{:else}
					<label
						class="zone-upload"
						class:over={draggingZoneId === zone.id}
						for="file-{zone.id}"
						ondragover={(e) => {
							e.preventDefault();
							draggingZoneId = zone.id;
						}}
						ondragleave={() => (draggingZoneId = null)}
						ondrop={(e) => onZoneDrop(e, zone)}
					>
						<input
							id="file-{zone.id}"
							data-testid="file-input-{zone.id}"
							type="file"
							accept="image/*"
							onchange={(e) => onZoneFilePick(e, zone)}
						/>
						<span class="zone-upload-plus" aria-hidden="true">+</span>
					</label>
				{/if}
				<span class="zone-slot-label mono">{zone.label}</span>
			</div>
		{/each}
	</div>

	<div class="status-line mono">
		{#if images.length}
			<span class="cap-dot ready" aria-hidden="true"></span>
			{images.length} image{images.length !== 1 ? 's' : ''} · compressed
		{:else}
			<span class="cap-dot" aria-hidden="true"></span>
			No images captured
		{/if}
	</div>
</div>

<style>
	.capture {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.capture-hdr {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.btn-sm {
		height: 26px;
		padding: 0 14px;
		background: var(--surface-2);
		border: 1px solid var(--line-2);
		border-radius: 999px;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		color: var(--ink-2);
		font-family: var(--font-sans);
	}
	.btn-sm:hover {
		background: var(--surface);
		border-color: var(--ink-3);
	}

	.upload-hint {
		font-size: 12px;
		color: var(--ink-2);
	}

	/* Camera UI */
	.cam-ui {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.cam-select-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.cam-select-row .label {
		white-space: nowrap;
	}
	.cam-select-row .inp {
		flex: 1;
		height: 30px;
		font-size: 12px;
	}
	.cam-live {
		position: relative;
		background: var(--ink);
		border-radius: var(--r);
		overflow: hidden;
	}
	.cam-live video {
		width: 100%;
		display: block;
		max-height: 200px;
		object-fit: cover;
	}
	.cam-zone-badge {
		position: absolute;
		top: 8px;
		left: 8px;
		background: rgba(14, 22, 38, 0.7);
		color: #fff;
		font-size: 10px;
		padding: 3px 10px;
		border-radius: 999px;
		letter-spacing: 0.04em;
	}
	.cam-flash {
		position: absolute;
		inset: 0;
		background: #fff;
		opacity: 0;
		pointer-events: none;
	}
	.cam-flash.on {
		opacity: 1;
		transition: opacity 0.3s;
	}
	.cam-controls {
		display: flex;
		gap: 8px;
	}
	.cam-controls .btn {
		flex: 1;
		width: auto;
	}
	.cam-controls .btn-secondary {
		flex: 0 0 auto;
	}

	/* Per-zone upload slots */
	.zone-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
	@media (max-width: 480px) {
		.zone-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.zone-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
	}
	.zone-slot-label {
		font-size: 9px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-3);
	}
	.zone-slot.filled .zone-slot-label {
		color: var(--sev-pass);
	}
	.zone-upload {
		width: 100%;
		aspect-ratio: 1;
		border: 1.5px dashed var(--line-2);
		border-radius: var(--r);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		background: var(--surface-2);
		position: relative;
		transition: all 0.15s;
	}
	.zone-upload:hover,
	.zone-upload.over {
		border-color: var(--accent);
		background: var(--accent-wash);
	}
	.zone-upload input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
		height: 100%;
	}
	.zone-upload-plus {
		font-size: 20px;
		font-weight: 500;
		color: var(--ink-3);
		line-height: 1;
	}
	.zone-thumb {
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--r);
		overflow: hidden;
		border: 1px solid var(--line);
		position: relative;
		background: var(--surface-2);
	}
	.zone-thumb img {
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
