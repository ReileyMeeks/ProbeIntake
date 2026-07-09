/**
 * Downscale images before they go into a `CapturedImage`.
 *
 * Real probe photos run ~3.6MB / 4000×3000 straight off a phone camera.
 * Sending several of those per `/api/analyze` request is slow (a single
 * un-downscaled image took ~16s round-trip in testing) and risks hitting
 * provider payload-size limits. Every image — uploaded or camera-captured —
 * gets redrawn onto a canvas capped at `MAX_DIMENSION` on its long edge and
 * re-exported as JPEG before it's stored.
 */

/** Long edge cap, in pixels, for any image we store. */
export const MAX_DIMENSION = 1600;

/** JPEG re-encode quality used for the downscaled output. */
export const JPEG_QUALITY = 0.8;

export interface DownscaledImage {
	mediaType: 'image/jpeg';
	/** Raw base64 (no `data:` prefix) — this is what the proxy forwards as `image.source.data`. */
	base64: string;
	/** Full `data:image/jpeg;base64,...` URL, ready for an `<img src>` thumbnail. */
	dataUrl: string;
}

/**
 * Target size for a `width`×`height` source once capped at `maxDimension` on
 * the long edge, preserving aspect ratio. Returns the input unchanged if it's
 * already within bounds. Pure function — no DOM/canvas dependency, so it's
 * safe to unit-test directly.
 */
export function computeDownscaledSize(
	width: number,
	height: number,
	maxDimension: number = MAX_DIMENSION
): { width: number; height: number } {
	if (!(width > 0) || !(height > 0)) return { width: 1, height: 1 };
	if (width <= maxDimension && height <= maxDimension) return { width, height };
	if (width >= height) {
		return {
			width: maxDimension,
			height: Math.max(1, Math.round((height * maxDimension) / width))
		};
	}
	return { width: Math.max(1, Math.round((width * maxDimension) / height)), height: maxDimension };
}

/** Splits the base64 payload out of a `data:...;base64,...` URL, if present. */
function base64FromDataUrl(dataUrl: string): string | null {
	const marker = 'base64,';
	const idx = dataUrl.indexOf(marker);
	if (idx === -1) return null;
	const b64 = dataUrl.slice(idx + marker.length);
	return b64 || null;
}

/**
 * Draw `source` onto a canvas capped at `maxDimension` on the long edge and
 * export as JPEG at `quality`.
 *
 * `naturalWidth`/`naturalHeight` must be the source's untouched pixel
 * dimensions (the caller already has these from `<img>`/`<video>` load
 * events) — this function never waits on decode itself.
 *
 * Degrades gracefully when canvas 2D isn't available or drawing fails (e.g.
 * jsdom in unit tests — `getContext('2d')`/`toDataURL` both return `null`
 * there rather than throwing): falls back to `fallbackDataUrl` untouched, so
 * callers always get a usable `CapturedImage` instead of a crash. Real
 * browsers always have working canvas support, so this only ever engages as
 * a test-environment escape hatch.
 */
export function downscaleToJpeg(
	source: CanvasImageSource | null | undefined,
	naturalWidth: number,
	naturalHeight: number,
	fallbackDataUrl: string,
	opts: { maxDimension?: number; quality?: number } = {}
): DownscaledImage {
	const { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = opts;
	let exported: string | null = null;

	if (source && naturalWidth > 0 && naturalHeight > 0 && typeof document !== 'undefined') {
		const { width, height } = computeDownscaledSize(naturalWidth, naturalHeight, maxDimension);
		try {
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.drawImage(source, 0, 0, width, height);
				const candidate = canvas.toDataURL('image/jpeg', quality);
				if (typeof candidate === 'string' && candidate.startsWith('data:')) {
					exported = candidate;
				}
			}
		} catch {
			exported = null;
		}
	}

	const resolvedDataUrl = exported ?? fallbackDataUrl;
	return {
		mediaType: 'image/jpeg',
		base64: base64FromDataUrl(resolvedDataUrl) ?? '',
		dataUrl: resolvedDataUrl
	};
}
