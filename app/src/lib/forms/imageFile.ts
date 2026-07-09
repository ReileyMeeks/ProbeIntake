/**
 * Shared `File`/`<video>` → pixel-data helpers used by both capture surfaces
 * (`CapturePanel`'s per-zone probe photos and `InspectionForm`'s eval-form
 * images). Split out so the decode dance isn't duplicated between them.
 */

// jsdom never fires <img>.onload/.onerror for a `data:` URL src (images
// aren't actually decoded there), so decode is raced against this timeout as
// a test-environment escape hatch. Real browsers decode even large photos in
// a handful of ms, so this only ever fires in a test/headless environment —
// production always resolves via `onload` first.
const DECODE_TIMEOUT_MS = 200;

/** Reads `file` into a `data:` URL. */
export function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
		reader.readAsDataURL(file);
	});
}

/** Resolves with a loaded `<img>`, or `null` if decode errors or times out. */
export function loadImageElement(
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
