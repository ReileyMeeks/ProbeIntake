import '@testing-library/jest-dom/vitest';

// pdfjs-dist (imported by InspectionForm) reads `DOMMatrix` at module-eval
// time (`const SCALE_MATRIX = new DOMMatrix();` in its canvas display
// layer) — jsdom doesn't implement `DOMMatrix`, so merely importing the
// module throws before any test body runs. `@napi-rs/canvas` (already an
// optional dependency of pdfjs-dist, present in node_modules) ships a real
// DOMMatrix implementation; polyfilling it here is enough to let the module
// load under jsdom. Actual PDF *rendering* still can't run in jsdom (no
// working 2D canvas) — see the note in inspectionForm.svelte.test.ts.
if (typeof globalThis.DOMMatrix === 'undefined') {
	const { DOMMatrix } = await import('@napi-rs/canvas');
	// @ts-expect-error - test-environment polyfill, not a full DOM type match
	globalThis.DOMMatrix = DOMMatrix;
}

// jsdom doesn't implement the Web Animations API — Svelte 5's `fly`/`fade`
// transitions (used by +page.svelte's intake↔quote swap) call
// `element.animate()` under the hood, which throws "not a function" without
// this. A minimal stub is enough: tests never assert on animation timing
// itself, only on the DOM state before/after the transition.
if (typeof Element !== 'undefined' && typeof Element.prototype.animate !== 'function') {
	Element.prototype.animate = () =>
		({
			finished: Promise.resolve(),
			cancel: () => {},
			pause: () => {},
			play: () => {},
			finish: () => {},
			onfinish: null,
			oncancel: null,
			effect: null,
			currentTime: 0,
			playbackRate: 1
		}) as unknown as Animation;
}
