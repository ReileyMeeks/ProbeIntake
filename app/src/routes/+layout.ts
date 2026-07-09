/**
 * This is a client-only SPA (built with `adapter-static` + a `fallback:
 * 'index.html'`, served behind the Vapor proxy — see app/CLAUDE.md).
 * Disabling SSR keeps every route's Node-side render out of the picture
 * entirely, which matters now that `InspectionForm` imports `pdfjs-dist`:
 * that module reads browser-only globals (`DOMMatrix`) at import time, which
 * don't exist in Node and would otherwise crash both `vite dev`'s SSR pass
 * and any future prerender attempt.
 */
export const ssr = false;
