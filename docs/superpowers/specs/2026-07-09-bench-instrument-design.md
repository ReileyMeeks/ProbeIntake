# Design Spec — "Bench Instrument" (Avante Probe Intake SPA)

**Approved direction (2026-07-09):** light, precision-tool workspace. Reads like purpose-built
diagnostic hardware, not a marketing page and not generic AI output. Drops the navy header.

## Subject & job
A repair-lab bench tool. A technician (often on a bright shop tablet, landscape) photographs an
incoming ultrasound probe + its eval form; an AI engine returns findings + a repair quote. World:
transducers, zones (lens → housing → strain relief → cable → connector), serial/REF codes, work
orders. Page's one job: capture intake → run analysis → read/export the quote.

## Signature element — ProbeSchematic
The one memorable, subject-true element. A clean SVG side-view of a convex probe drawn as geometric
segments left→right — **lens (convex tip) → housing → strain relief boot → cable (curve) → connector
block**. Each segment is a zone with state. It appears in BOTH panes:
- **capture mode** (intake pane): a capture guide. Zones outlined in `--line`; captured zones filled
  `--accent-wash` + `--accent` stroke; the current zone gets a subtle pulse (respect reduced-motion).
  Mono label under each zone.
- **findings mode** (quote pane): a findings map. Each zone carries a severity signal dot; zones with
  findings take the severity stroke color. Small legend.
Thin strokes (1.5px), geometric, monochrome + one accent + severity signals. This is the ONLY bold
element — everything else stays quiet.
Component: `app/src/lib/ui/ProbeSchematic.svelte`.
Props: `mode: 'capture' | 'findings'`, `zones: { key: string; label: string; state?: 'pending'|'current'|'captured'; severity?: Severity }[]`.
Zone keys/labels: `lens`/"Lens", `housing`/"Housing", `strain`/"Strain relief", `cable`/"Cable", `connector`/"Connector".

## Type
Self-hosted (installed): `@fontsource/ibm-plex-sans` (400/500/600/700), `@fontsource/ibm-plex-mono`
(400/500/600). Import once in the root layout.
- **Body/UI:** IBM Plex Sans. Base 13px, line-height 1.5, color `--ink`.
- **Mono (the instrument signature):** IBM Plex Mono for all *codes and readouts* — S/N, REF, WO#,
  model, status chip, priority tags — and for eyebrow/section labels (uppercase, `letter-spacing:.08em`,
  10–11px, color `--ink-3`).
- **Section titles:** Plex Sans 600.
- No other typefaces.

## Color tokens (`:root`)
```
--bg:#F7F8FA; --surface:#FFFFFF; --surface-2:#FBFCFD;
--ink:#0E1626; --ink-2:#46536B; --ink-3:#8A97AC;
--line:#E4E8EF; --line-2:#D0D6E0;
--accent:#1B4DFF; --accent-ink:#143BCC; --accent-wash:rgba(27,77,255,.06);
/* severity signal system (findings) */
--sev-major:#E5484D; --sev-moderate:#F5A524; --sev-minor:#8A97AC; --sev-pass:#30A46C; --sev-flag:#1B4DFF;
--r-sm:6px; --r:10px; --r-lg:14px;
--shadow:0 1px 2px rgba(14,22,38,.04),0 1px 3px rgba(14,22,38,.06);
```
Light theme only (bright bench). No gradients except at most a hairline accent; no glow.

## Layout
- **Top strip (~48px, not a header):** `--surface` with a hairline bottom border. Left: the logo mark
  (`/logo.png`, ~22px) + `avante` (mono 600, `--ink`) + hairline divider + `probe intake` (mono,
  `--ink-3`). Right: a live **status chip** (mono: `● ready` / `◐ analyzing…`; dot colored `--sev-pass`
  when ready, `--accent` when analyzing) and, when set, the `WO#` (mono, `--ink-2`). No navy, no
  workflow bar.
- **Workspace:** centered, `max-width:1240px`, padding `20px`. CSS grid `1fr 1fr`, gap `16px`;
  stacks to one column below ~900px.
- **Left pane — INTAKE** (`--surface` card, `--r-lg`, `--shadow`, hairline border): eyebrow `INTAKE`;
  the metadata fields; the ProbeSchematic in `capture` mode; the CapturePanel (dropzone + camera +
  zone-tagged thumbnails); the primary **Analyze probe** button (full-width, `--accent`).
- **Right pane — QUOTE** (`--surface` card): empty state = quiet line "Run analysis to generate a
  repair quote." After analysis: probe-id line (`model` · `mfg`; `S/N` and `REF` in mono); the
  ProbeSchematic in `findings` mode; findings list (severity dot + zone + description + source);
  quote items (item + priority pill + rationale); overall condition + confidence.

## Component styling (restyle to tokens)
- **Inputs:** label = mono eyebrow (`--ink-3`); field = `--surface`, 1px `--line-2` border, `--r-sm`,
  36px tall, focus = `--accent` border + 3px `--accent-wash` ring. Grid the fields 2-up.
- **CapturePanel:** dropzone = dashed `--line-2`, hover/drag = `--accent` border + `--accent-wash`.
  Thumbnails clean, `--r-sm`, hairline border; remove button on hover; zone tag = mono chip.
- **Findings row:** leading severity dot (`--sev-*`), zone (Plex Sans 600), description (`--ink-2`),
  source as a mono micro-tag.
- **Priority pill:** mono, uppercase, tiny; Required = `--accent` on `--accent-wash`; Recommended =
  `--ink-2` on `--surface-2`; Optional = `--ink-3`.
- **Login page:** centered card on `--bg`; mono `avante · probe intake` wordmark; single password
  field (styled as above); `--accent` "Sign in" button; error = `--sev-major` text.

## Copy (end-user voice, sentence case)
- Primary action: "Analyze probe" → while running "Analyzing…".
- Quote empty state: "Run analysis to generate a repair quote."
- Capture empty: "Drop probe photos or use the camera. Tag each by zone."
- Login error: "Incorrect password."
- Section eyebrows: `INTAKE`, `QUOTE`, `PROBE ZONES`.
No emoji. No exclamation marketing. Buttons name the exact action.

## Quality floor (non-negotiable, don't announce)
Responsive to mobile (panes stack, strip wraps gracefully); visible keyboard focus (the cobalt ring
on every control); `prefers-reduced-motion` disables the schematic pulse; `npm run build` warning-free;
Prettier clean; existing Vitest suite stays green.

## Restraint
Bold lives only in the ProbeSchematic. Everything else: hairlines, whitespace, mono accents, calm.
Before finishing, remove one thing that isn't earning its place.

## Revisions (2026-07-09, user feedback)
- **Pill shapes:** all single-line text inputs AND all buttons are fully pill-shaped
  (`border-radius:999px`), with enough horizontal padding (~16px) that text isn't cramped. The
  multi-line tech-notes textarea uses a large radius (`--r-lg`/16px), NOT a full pill. Chips/tags/
  priority pills already pill. Keep the cobalt focus ring on the pill inputs.
- **Per-zone file upload:** CapturePanel becomes a set of per-zone upload slots — one per zone
  (`lens`, `housing`, `strain`, `cable`, `connector`) plus a `form` slot (sets `isForm:true`). Each
  slot: a labeled upload control (its own `<input type=file>`) + thumbnail when filled + remove; the
  downscale pipeline (1600px/q0.8) and the `CapturedImage` contract are unchanged (each captured image
  carries its `zone`). Camera capture assigns into the currently-selected zone. The zones with images
  drive the intake-pane ProbeSchematic `captured` states.

## Revisions 2 (2026-07-09, user feedback)
- **Interactive ProbeSchematic capture:** the probe diagram IS the capture control. Each zone
  segment (lens/housing/strain/cable/connector) is a clickable, keyboard-focusable target; clicking
  opens a file picker (and camera option) for THAT zone. A filled zone shows its captured state
  (fill + a small thumbnail/check). This replaces the separate per-zone slot grid for probe zones.
  Keep downscale + CapturedImage(zone) contract. Accessible: each zone focusable, Enter/Space opens.
- **Inspection-form section (PDF):** a dedicated "Inspection form" upload area, separate from the
  probe zones, accepting PDF **and** images. On PDF, render each page to an image client-side
  (`pdfjs-dist`) → add as `isForm:true` CapturedImages (so the model reads it as images — no backend
  change). On image upload, add directly as `isForm:true`. Show page/image thumbnails + remove.
- **Intake → Quote as transitioned views (not side-by-side):** `+page.svelte` holds
  `view: 'intake' | 'quote'`. Intake is a single full-width column (comfortable max-width ~900px,
  centered): fields → interactive ProbeSchematic capture → Inspection-form section → "Analyze probe".
  On success, transition (fly/fade, respect reduced-motion) to a full-width Quote view (ResultsView +
  a "New intake"/back control; leave room for Export/Email actions which Task 15 wires). Keep the
  analyze result in memory (state swap, not a route change).
