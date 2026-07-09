# CLAUDE.md

## Project overview

SvelteKit **static** SPA (`adapter-static`) — the frontend for Avante Probe Intake. It builds to
plain HTML/JS/CSS and is served by the Vapor proxy in `../proxy`, which also holds all secrets and
proxies the model/email APIs. The browser holds no API keys.

## Core facts

- **Auth**: shared-password gate. The SPA calls `/api/login` and, on load, `GET /api/session` (in
  `src/routes/+layout.svelte`) to redirect unauthenticated visitors to `/login`. No client-side
  secrets; the session cookie is set by the proxy.
- **API**: all backend calls go through `src/lib/api/client.ts` (`login`, `checkSession`,
  `postAnalyze`, `extractForm`, `postEmail`) with `credentials: 'include'`, same-origin.
- **Design**: "Bench Instrument" system — IBM Plex Sans/Mono, cobalt accent, severity signal colors,
  pill inputs/buttons. Tokens live in `src/routes/layout.css` (plain CSS custom properties — **no
  Tailwind**). Spec: `../docs/superpowers/specs/2026-07-09-bench-instrument-design.md`.
- **Signature UI**: `src/lib/ui/ProbeSchematic.svelte` — the interactive probe diagram (click a zone
  to attach its photo; findings map colors zones by severity).

## Workflow

- Install `npm install` · Dev `npm run dev` · Build `npm run build` · Test `npm test` ·
  Types `npm run check` · Format `npm run lint`
- Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`). Tests colocated as `*.test.ts` / `*.svelte.test.ts`.
- `npm run build` must stay warning-free and `npm run check` at 0 errors.
