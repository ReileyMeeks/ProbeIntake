/**
 * Runtime detection for SVG-in-backdrop-filter support.
 *
 * Why not `@supports`? There's no CSS feature query that catches this
 * specific combo. The `backdrop-filter` property reports supported even
 * on Safari/Firefox, but those browsers silently ignore the
 * `url(#filter)` reference inside the filter chain — you get an
 * un-distorted (and possibly un-blurred) result. The only reliable
 * signal is the rendering engine.
 *
 * Heuristic: Chromium-based browsers honor SVG references in
 * `backdrop-filter`. Everything else gets L1+L2 only, which is what
 * the design contract specifies anyway.
 *
 * Re-evaluate this when:
 *   • Safari ships native support (track via WebKit bugs)
 *   • Firefox enables `layout.css.backdrop-filter.enabled` by default
 */
export function supportsBackdropSvgFilter(): boolean {
	if (typeof window === 'undefined') return false;
	const ua = navigator.userAgent;
	// Chrome / Chromium / Edge. Exclude Opera (OPR) and Yandex (YaBrowser)
	// since their backdrop-filter pipelines diverge from upstream Chromium
	// in ways that have broken this combination historically.
	const isChromium = /Chrome|Chromium|Edg/.test(ua) && !/OPR|YaBrowser/.test(ua);
	// Defense in depth: ensure the property exists at all. If a future
	// Chromium drops backdrop-filter (vanishingly unlikely) we degrade
	// to L1+L2 instead of throwing CSS errors at runtime.
	const hasBackdrop =
		'backdropFilter' in document.documentElement.style ||
		'webkitBackdropFilter' in document.documentElement.style;
	return isChromium && hasBackdrop;
}
