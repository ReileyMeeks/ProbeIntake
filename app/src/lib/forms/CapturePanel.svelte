<script lang="ts">
	import type { CapturedImage } from '$lib/domain/probe';
	import { downscaleToJpeg } from './downscale';
	import { fileToDataUrl, loadImageElement } from './imageFile';
	import { onDestroy } from 'svelte';
	import ProbeSchematic, { type ProbeZone } from '$lib/ui/ProbeSchematic.svelte';

	interface Zone {
		id: string;
		label: string;
	}

	/**
	 * The probe schematic itself is the capture control (Revisions 2,
	 * 2026-07-09): clicking/activating a zone segment opens a file picker
	 * scoped to that zone via a hidden per-zone `<input type=file>`. The
	 * camera (when active) captures into whichever zone is currently
	 * selected — clicking a different zone while the camera is running just
	 * retargets it, rather than opening a picker. See "Interactive
	 * ProbeSchematic capture" in
	 * docs/superpowers/specs/2026-07-09-bench-instrument-design.md.
	 */
	const ZONES: Zone[] = [
		{ id: 'lens', label: 'Lens' },
		{ id: 'housing', label: 'Housing' },
		{ id: 'strain', label: 'Strain relief' },
		{ id: 'cable', label: 'Cable' },
		{ id: 'connector', label: 'Connector' }
	];

	// Mutated in place (push/splice/index-assign) throughout this file rather
	// than reassigned — that's what makes a caller's own `$state` array (see
	// capture.svelte.test.ts) observe the change directly, since it's the same
	// underlying array/proxy rather than a new one only the child holds.
	let { images = $bindable<CapturedImage[]>([]) }: { images?: CapturedImage[] } = $props();

	let fileInputs: Record<string, HTMLInputElement | undefined> = $state({});

	// ── Camera state ──────────────────────────────────────────────────────
	const cameraSupported =
		typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
	let cameraActive = $state(false);
	let cameraError: string | null = $state(null);
	let videoEl: HTMLVideoElement | undefined = $state();
	let devices: MediaDeviceInfo[] = $state([]);
	let selectedDeviceId: string | undefined = $state(undefined);
	let activeZoneId = $state(ZONES[0].id);
	let flashing = $state(false);
	let stream: MediaStream | null = null;

	const activeZoneLabel = $derived(ZONES.find((z) => z.id === activeZoneId)?.label ?? 'Capture');

	function imageForZone(zoneId: string): CapturedImage | undefined {
		return images.find((img) => img.zone === zoneId && !img.isForm);
	}

	function firstEmptyZoneId(): string | undefined {
		return ZONES.find((z) => !imageForZone(z.id))?.id;
	}

	const captureZones = $derived.by((): ProbeZone[] => {
		const firstPendingIdx = ZONES.findIndex((z) => !imageForZone(z.id));
		return ZONES.map((z, i) => ({
			key: z.id,
			label: z.label,
			state: imageForZone(z.id) ? 'captured' : i === firstPendingIdx ? 'current' : 'pending'
		}));
	});

	const thumbnails = $derived.by(() => {
		const map: Record<string, string> = {};
		for (const z of ZONES) {
			const img = imageForZone(z.id);
			if (img) map[z.id] = img.dataUrl;
		}
		return map;
	});

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
			isForm: false,
			zone: zone.id
		};
		const idx = images.findIndex((img) => img.zone === zone.id && !img.isForm);
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

	function removeZoneImage(zoneId: string) {
		const idx = images.findIndex((img) => img.zone === zoneId && !img.isForm);
		if (idx !== -1) images.splice(idx, 1);
	}

	/** Activating a schematic zone opens its file picker — or, while the camera is running, retargets the camera instead. */
	function activateZone(zoneId: string) {
		if (cameraActive) {
			activeZoneId = zoneId;
			return;
		}
		fileInputs[zoneId]?.click();
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
		<h2 class="eyebrow">Probe zones</h2>
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

	<p class="upload-hint">Click a zone on the diagram to upload a photo, or use the camera above.</p>

	<ProbeSchematic mode="capture" zones={captureZones} {thumbnails} onZoneActivate={activateZone} />

	<!-- One hidden file input per zone — the schematic's click/keyboard
	     handler opens the matching input via `.click()`. Kept in the DOM
	     (visually hidden, not display:none) rather than only on demand so a
	     stable, testable `data-testid` always exists. -->
	<div class="zone-inputs">
		{#each ZONES as zone (zone.id)}
			<input
				bind:this={fileInputs[zone.id]}
				data-testid="file-input-{zone.id}"
				type="file"
				accept="image/*"
				class="sr-only-input"
				tabindex={-1}
				aria-hidden="true"
				onchange={(e) => onZoneFilePick(e, zone)}
			/>
		{/each}
	</div>

	{#if images.some((img) => !img.isForm)}
		<div class="captured-list">
			{#each ZONES as zone (zone.id)}
				{@const img = imageForZone(zone.id)}
				{#if img}
					<span class="captured-chip mono">
						{zone.label}
						<button
							type="button"
							class="chip-rm"
							aria-label="Remove {zone.label} image"
							onclick={() => removeZoneImage(zone.id)}>×</button
						>
					</span>
				{/if}
			{/each}
		</div>
	{/if}

	<div class="status-line mono">
		{#if images.some((img) => !img.isForm)}
			<span class="cap-dot ready" aria-hidden="true"></span>
			{images.filter((img) => !img.isForm).length} probe image{images.filter((img) => !img.isForm)
				.length !== 1
				? 's'
				: ''} · compressed
		{:else}
			<span class="cap-dot" aria-hidden="true"></span>
			No probe images captured
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

	/* Hidden per-zone file inputs — visually hidden, not display:none, so
	   programmatic .click() from the schematic behaves consistently and the
	   element stays queryable/testable. */
	.zone-inputs {
		position: relative;
		width: 0;
		height: 0;
		overflow: hidden;
	}
	.sr-only-input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		overflow: hidden;
	}

	/* Captured-zone chips — remove control, distinct from clicking the
	   schematic zone itself (which re-opens the picker to replace). */
	.captured-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.captured-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 10px;
		letter-spacing: 0.02em;
		color: var(--sev-pass);
		background: var(--surface-2);
		border: 1px solid var(--line);
		border-radius: 999px;
		padding: 3px 6px 3px 10px;
	}
	.chip-rm {
		width: 15px;
		height: 15px;
		background: transparent;
		border: none;
		color: var(--ink-3);
		font-size: 12px;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
	}
	.chip-rm:hover {
		background: var(--line);
		color: var(--ink);
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
