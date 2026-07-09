<script lang="ts">
	import type { CapturedImage } from '$lib/domain/probe';
	import { downscaleToJpeg } from './downscale';
	import { onDestroy } from 'svelte';

	interface Zone {
		id: string;
		label: string;
		isForm: boolean;
	}

	/** Ported from the HTML mockup's `ZONES` (JS lines ~375-384). */
	const ZONES: Zone[] = [
		{ id: 'lens', label: 'Lens', isForm: false },
		{ id: 'housing', label: 'Housing', isForm: false },
		{ id: 'strain', label: 'Strain Relief', isForm: false },
		{ id: 'cable', label: 'Cable', isForm: false },
		{ id: 'connector', label: 'Connector', isForm: false },
		{ id: 'label', label: 'Probe Label', isForm: false },
		{ id: 'form-f', label: 'Form Front', isForm: true },
		{ id: 'form-b', label: 'Form Back', isForm: true }
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

	let fileInputEl: HTMLInputElement | undefined = $state();
	let dragging = $state(false);
	let zoneIdx = $state(0);

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

	const currentZone = $derived(zoneIdx < ZONES.length ? ZONES[zoneIdx] : null);

	function zoneStatus(zone: Zone, i: number): 'captured' | 'form' | 'current' | 'pending' {
		const captured = images.some((img) => img.zone === zone.id);
		if (captured) return zone.isForm ? 'form' : 'captured';
		return i === zoneIdx ? 'current' : 'pending';
	}

	function jumpZone(i: number) {
		zoneIdx = i;
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

	async function addFromDataUrl(originalDataUrl: string, zone?: Zone) {
		const imgEl = await loadImageElement(originalDataUrl);
		const width = imgEl?.naturalWidth || 0;
		const height = imgEl?.naturalHeight || 0;
		const downscaled = downscaleToJpeg(imgEl, width, height, originalDataUrl);
		images.push({
			mediaType: downscaled.mediaType,
			base64: downscaled.base64,
			dataUrl: downscaled.dataUrl,
			isForm: zone?.isForm ?? false,
			zone: zone?.id
		});
	}

	async function addFiles(files: Iterable<File>) {
		for (const file of files) {
			if (!file.type.startsWith('image/')) continue;
			const originalDataUrl = await fileToDataUrl(file);
			await addFromDataUrl(originalDataUrl);
		}
	}

	async function onFilePick(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) await addFiles(input.files);
		input.value = '';
	}

	async function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (e.dataTransfer?.files?.length) await addFiles(e.dataTransfer.files);
	}

	function removeImage(i: number) {
		images.splice(i, 1);
	}

	function setZone(i: number, zoneId: string) {
		const zoneDef = ZONES.find((z) => z.id === zoneId);
		images[i] = { ...images[i], zone: zoneDef?.id, isForm: zoneDef?.isForm ?? false };
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
			zoneIdx = 0;
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
		flashing = true;
		setTimeout(() => (flashing = false), 350);
		const zone = currentZone ?? undefined;
		const width = videoEl.videoWidth || 0;
		const height = videoEl.videoHeight || 0;
		const downscaled = downscaleToJpeg(videoEl, width, height, '');
		images.push({
			mediaType: downscaled.mediaType,
			base64: downscaled.base64,
			dataUrl: downscaled.dataUrl,
			isForm: zone?.isForm ?? false,
			zone: zone?.id
		});
		if (zoneIdx < ZONES.length - 1) zoneIdx++;
	}

	function retakeShot() {
		if (!images.length) return;
		images.pop();
		if (zoneIdx > 0) zoneIdx--;
	}

	onDestroy(() => {
		stream?.getTracks().forEach((t) => t.stop());
	});
</script>

<div class="card">
	<div class="card-hdr">
		<div class="card-icon" style="background:#f0fdfa;color:var(--teal)">📷</div>
		<div>
			<div class="card-title">Capture images</div>
			<div class="card-sub">Probe zones + form front &amp; back</div>
		</div>
		<div class="cam-bar">
			{#if cameraSupported && !cameraActive}
				<button type="button" class="cam-btn-sm" onclick={startCamera}>▶ Camera</button>
			{:else if cameraActive}
				<button type="button" class="cam-btn-sm" onclick={stopCamera}>■ Stop</button>
			{/if}
		</div>
	</div>

	{#if cameraError}
		<p class="cam-error" role="alert">{cameraError}</p>
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

			<div class="zone-pills">
				{#each ZONES as zone, i (zone.id)}
					<button type="button" class="zone-pill {zoneStatus(zone, i)}" onclick={() => jumpZone(i)}>
						{zone.label}{images.some((img) => img.zone === zone.id)
							? ' ✓'
							: i === zoneIdx
								? ' ●'
								: ''}
					</button>
				{/each}
			</div>

			<div class="cam-live">
				<!-- svelte-ignore a11y_media_has_caption -->
				<video bind:this={videoEl} autoplay playsinline muted></video>
				<div class="cam-zone-badge">
					{currentZone
						? `${currentZone.isForm ? '📋 ' : ''}${currentZone.label}`
						: '✓ All captured'}
				</div>
				<div class="cam-flash" class:on={flashing}></div>
			</div>

			<div class="cam-controls">
				<button type="button" class="btn-capture" onclick={captureShot}>📷 Capture</button>
				<button type="button" class="btn-retake" onclick={retakeShot}>Retake</button>
			</div>
		</div>
	{:else}
		<div class="card-body">
			<div
				class="upload-zone"
				class:over={dragging}
				role="button"
				tabindex="0"
				ondragover={(e) => {
					e.preventDefault();
					dragging = true;
				}}
				ondragleave={() => (dragging = false)}
				ondrop={onDrop}
				onclick={() => fileInputEl?.click()}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') fileInputEl?.click();
				}}
			>
				<input
					bind:this={fileInputEl}
					data-testid="file-input"
					type="file"
					multiple
					accept="image/*"
					onchange={onFilePick}
				/>
				<div class="upload-title">Drop images here or click to browse</div>
				<div class="upload-sub">JPG, PNG · probe zones + form front &amp; back</div>
			</div>
		</div>
	{/if}

	<div class="img-section">
		{#if images.length}
			<div class="img-grid">
				{#each images as img, i (i)}
					<div class="thumb">
						<img src={img.dataUrl} alt={img.zone ? `${img.zone} capture` : `capture ${i + 1}`} />
						<select
							class="thumb-zone"
							aria-label="Zone for this image"
							value={img.zone ?? ''}
							onchange={(e) => setZone(i, (e.target as HTMLSelectElement).value)}
						>
							<option value="">— zone —</option>
							{#each ZONES as zone (zone.id)}
								<option value={zone.id}>{zone.label}</option>
							{/each}
						</select>
						<button
							type="button"
							class="thumb-rm"
							aria-label="Remove image"
							onclick={() => removeImage(i)}>✕</button
						>
					</div>
				{/each}
			</div>
			<div class="status-pill ready">
				<div class="pill-dot green"></div>
				{images.length} image{images.length !== 1 ? 's' : ''} · compressed
			</div>
		{:else}
			<div class="status-pill empty">
				<div class="pill-dot gray"></div>
				No images captured
			</div>
		{/if}
	</div>
</div>

<style>
	.card {
		background: var(--s2);
		border: 1px solid var(--b1);
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}
	.card-hdr {
		padding: 11px 14px 10px;
		border-bottom: 1px solid var(--b1);
		display: flex;
		align-items: center;
		gap: 9px;
	}
	.card-icon {
		width: 26px;
		height: 26px;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-size: 13px;
	}
	.card-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--t1);
	}
	.card-sub {
		font-size: 10px;
		color: var(--t4);
		margin-top: 1px;
	}
	.card-body {
		padding: 13px;
	}
	.cam-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
	}
	.cam-btn-sm {
		height: 24px;
		padding: 0 9px;
		background: var(--s0);
		border: 1px solid var(--b2);
		border-radius: 6px;
		font-size: 10px;
		font-weight: 500;
		cursor: pointer;
		color: var(--t2);
		font-family: inherit;
	}
	.cam-btn-sm:hover {
		background: var(--b1);
	}
	.cam-error {
		font-size: 10px;
		color: var(--red);
		padding: 8px 14px 0;
	}

	/* Camera UI */
	.cam-ui {
		border-bottom: 1px solid var(--b1);
	}
	.cam-select-row {
		padding: 10px 13px 0;
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.cam-select-row .label {
		white-space: nowrap;
	}
	.cam-select-row .inp {
		flex: 1;
		height: 28px;
		font-size: 10px;
	}
	.zone-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		padding: 10px 13px 6px;
	}
	.zone-pill {
		font-size: 9px;
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 20px;
		cursor: pointer;
		border: 1px solid;
		transition: all 0.15s;
		font-family: inherit;
	}
	.zone-pill.pending {
		background: var(--s0);
		color: var(--t4);
		border-color: var(--b2);
	}
	.zone-pill.current {
		background: rgba(37, 99, 235, 0.1);
		color: var(--accent);
		border-color: rgba(37, 99, 235, 0.3);
	}
	.zone-pill.captured {
		background: rgba(22, 163, 74, 0.1);
		color: #15803d;
		border-color: rgba(22, 163, 74, 0.3);
	}
	.zone-pill.form {
		background: rgba(13, 148, 136, 0.1);
		color: var(--teal);
		border-color: rgba(13, 148, 136, 0.3);
	}
	.cam-live {
		position: relative;
		background: #000;
		margin: 0 13px;
		border-radius: 9px;
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
		background: rgba(0, 0, 0, 0.7);
		color: #fff;
		font-size: 9px;
		font-weight: 700;
		padding: 3px 10px;
		border-radius: 20px;
		text-transform: uppercase;
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
		gap: 7px;
		padding: 10px 13px 13px;
	}
	.btn-capture {
		flex: 1;
		height: 40px;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: 9px;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		font-family: inherit;
		transition: background 0.15s;
	}
	.btn-capture:hover {
		background: var(--accent2);
	}
	.btn-retake {
		height: 40px;
		padding: 0 13px;
		background: var(--s0);
		color: var(--t2);
		border: 1px solid var(--b2);
		border-radius: 9px;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
	}

	/* Upload zone */
	.upload-zone {
		border: 1.5px dashed var(--b2);
		border-radius: 9px;
		padding: 14px;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s;
		background: var(--s1);
		position: relative;
	}
	.upload-zone:hover,
	.upload-zone.over {
		border-color: var(--accent);
		background: rgba(37, 99, 235, 0.04);
	}
	.upload-zone input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
		height: 100%;
	}
	.upload-title {
		font-size: 11px;
		font-weight: 500;
		color: var(--t2);
		margin-bottom: 2px;
	}
	.upload-sub {
		font-size: 10px;
		color: var(--t4);
	}

	/* Image grid */
	.img-section {
		padding: 0 13px 12px;
	}
	.img-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
		gap: 5px;
		margin-top: 4px;
	}
	.thumb {
		aspect-ratio: 1;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid var(--b1);
		position: relative;
		background: var(--s0);
		display: flex;
		flex-direction: column;
	}
	.thumb img {
		width: 100%;
		flex: 1;
		min-height: 0;
		object-fit: cover;
		display: block;
	}
	.thumb-zone {
		border: none;
		border-top: 1px solid var(--b1);
		background: var(--s2);
		font-size: 8px;
		color: var(--t3);
		padding: 1px 2px;
		font-family: inherit;
	}
	.thumb-rm {
		position: absolute;
		top: 3px;
		right: 3px;
		width: 15px;
		height: 15px;
		background: rgba(0, 0, 0, 0.65);
		border: none;
		border-radius: 50%;
		color: #fff;
		font-size: 9px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 10px;
		font-weight: 600;
		padding: 3px 9px;
		border-radius: 20px;
		margin-top: 8px;
	}
	.status-pill.empty {
		background: var(--s0);
		color: var(--t4);
	}
	.status-pill.ready {
		background: rgba(22, 163, 74, 0.1);
		color: #15803d;
	}
	.pill-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
	}
	.pill-dot.gray {
		background: var(--t4);
	}
	.pill-dot.green {
		background: var(--green);
	}

	.label {
		font-size: 9px;
		font-weight: 700;
		color: var(--t3);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.inp {
		height: 30px;
		padding: 0 9px;
		border: 1px solid var(--b2);
		border-radius: 7px;
		font-size: 11px;
		color: var(--t1);
		background: var(--s2);
		outline: none;
		font-family: inherit;
	}
	.inp:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}
</style>
