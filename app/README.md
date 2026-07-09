# app/ — Avante Probe Intake SPA

SvelteKit static SPA (`adapter-static`, Svelte 5 runes, TypeScript, Vitest). This is the frontend for
the Probe Intake tool; it talks to the Vapor proxy in `../proxy` over `/api` on the same origin. See
the [project README](../README.md) and [DOCKER.md](../DOCKER.md) for the full picture.

## Scripts

```sh
npm run dev        # dev server (proxies /api to the running backend)
npm run build      # static build → build/  (served by the proxy in the container)
npm test           # Vitest
npm run check      # svelte-check
npm run lint       # prettier --check
```

## Layout

- `src/routes/+page.svelte` — the intake → quote workspace
- `src/routes/login/` — shared-password login
- `src/lib/ui/ProbeSchematic.svelte` — the interactive probe diagram (click a zone to add its photo)
- `src/lib/ui/ResultsView.svelte` — findings + repair quote
- `src/lib/ui/report.ts` — jsPDF report export
- `src/lib/forms/` — intake fields, per-zone capture, image downscaling, PDF form rendering
- `src/lib/api/client.ts` — calls to the proxy (`login`, `checkSession`, `postAnalyze`, `extractForm`, `postEmail`)
- `src/lib/domain/probe.ts` — shared types

Design direction ("Bench Instrument") is in `../docs/superpowers/specs/2026-07-09-bench-instrument-design.md`.
