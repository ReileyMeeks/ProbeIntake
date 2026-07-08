# Avante Probe Intake — Migration Design

**Date:** 2026-07-08
**Status:** Approved design (pre-implementation)
**Source artifact:** `avante_probe_intake_FINAL (1).html` (single-file, 1,028 lines)

---

## 1. Problem & Goals

The current tool is a single HTML file that runs entirely in the browser. It:

- Collects probe metadata (model, S/N, REF, MFG, SO, customer) and inspection photos
  (file upload + live camera capture, zone-tagged).
- Sends images + a large fixed diagnostic system prompt **directly** from the browser to
  `api.anthropic.com` (`x-api-key` + `anthropic-dangerous-direct-browser-access: true`),
  currently model `claude-sonnet-4-6`.
- Receives structured JSON (findings + repair quote items), renders it, generates PDFs
  (jsPDF), and emails them via **EmailJS** (also client-side).

### Core problem

**All secrets live in the browser.** The Anthropic key is in `localStorage` and travels in
every request header — extractable by anyone who opens DevTools. EmailJS credentials ship to
the browser too. Anthropic's own header name (`anthropic-dangerous-direct-browser-access`)
flags this as unsafe.

### Goals

1. **Hide all API keys** behind a server that holds them and calls Anthropic on the client's
   behalf.
2. **Auth**: a single shared-password gate in front of the app.
3. **Host locally now, cloud later** without a rewrite.
4. **Push updates** with minimal manual effort.

### Non-goals (YAGNI)

- Per-user accounts / audit trail (shared password is sufficient for a trusted small shop).
- Persistence / database — the intake flow is stateless (intake → analyze → PDF/email).
- Multi-tenant support.
- Migrating away from Claude as the analysis model (kept; only moved server-side).

---

## 2. Chosen Architecture

A **small monorepo with two packages**, combined into one container for local running and
split into two deployables for cloud. The backend is **modeled on the existing `ticket-api`**
(`AvanteConnected/TicketApp/ticket-api`) — same house pattern, minus everything ProbeIntake
doesn't need.

```
probe-intake/
├─ app/            SvelteKit static SPA (adapter-static) — the UI
│                  Svelte 5 runes · TypeScript · Tailwind · Vitest
│                  Matches conventions of the existing `avconn` app.
│
├─ proxy/          Swift + Vapor 4 backend — the stable core (holds all secrets)
│                  Modeled on ticket-api; STATELESS (no Fluent/Postgres/Monday).
│                  • POST /api/analyze  → AiClient relays Messages API to the provider
│                  • POST /api/email    → Microsoft Graph email (ticket-api pattern)
│                  • Shared-password auth gate (signed session cookie)
│                  • Serves the built SPA files in the combined container
│
├─ Dockerfile            Multi-stage: build SPA + build Swift binary → one runtime image
│                        serving the SPA and /api on one port (ticket-api Dockerfile pattern).
└─ docker-compose.yml    proxy service + Watchtower (auto-pull new image, restart)
```

### Why this shape

- **The proxy is a server-side relay** — the pattern Anthropic itself prescribes for production
  (`.proxied`): the back end adds the credential server-side so the client ships no key. This
  is exactly what `ticket-api`'s `AiClient` already does.
- **Backend = Swift/Vapor 4**, reusing `ticket-api`'s proven code (see §3.2). Matches the
  `SwiftVaporAPITemplate` and the team's existing Swift-server pattern.
- **Frontend = static SPA** (`adapter-static`), matching the existing `avconn` app
  (Svelte 5 runes, TS, Tailwind, Vitest, `$lib/{ui,forms,domain}`, Azure Static Web Apps).

### Explicitly NOT using the Apple Foundation Models library

`ClaudeForFoundationModels` is a **client** Swift package for **native Apple apps**, and the
Foundation Models framework does not exist on Linux Swift. Our proxy is a Linux Vapor service
that calls the Messages API directly over HTTP via the reused `AiClient` — no Foundation
Models framework involved. (If a native iOS/Mac tech app is ever built, it could use that
library with `.proxied` auth pointed at this same proxy; the proxy remains the durable core.)

---

## 3. Components

### 3.1 `app/` — SvelteKit static SPA

Port of the existing HTML, reorganized into components. No behavior lost.

| Unit | Purpose | Depends on |
|------|---------|------------|
| Intake form | Probe metadata fields | — |
| Capture | File upload + live camera, zone tagging, thumbnails | browser MediaDevices |
| Analyze action | POSTs metadata + base64 images to proxy `/api/analyze` | proxy |
| Results view | Renders findings + quote items JSON | — |
| PDF export | jsPDF (full report + images) | jsPDF |
| Email action | POSTs report payload to proxy `/api/email` | proxy |
| Login page | Single password field → POST `/api/login` | proxy |

**Removed from the UI:** the entire client-side config bar (API key, EmailJS fields). All
secrets are now server-side.

**Config:** the SPA reads a single value — the proxy base URL. Local: same origin (empty
base). Deployed: `/api/*` rewritten to the proxy via `staticwebapp.config.json`.

### 3.2 `proxy/` — Swift Vapor backend (reuse `ticket-api`)

Start from `ticket-api` and **strip** what ProbeIntake doesn't need: Fluent/Postgres, all
migrations, Monday.com sync, the AI pipeline worker, ticket models. **Keep and adapt:**

| Reused from ticket-api | Adaptation for ProbeIntake |
|------------------------|-----------------------------|
| `Ai/AiClient.swift` + provider abstraction (`ResolvedProvider`, Anthropic **or** Azure AI Foundry) | **Extend `AiMessage.content` from `String` to the content-block array form** so it can carry base64 `{type:"image",…}` blocks plus a `{type:"text"}` block. This is the one substantive code change. |
| Prompt caching (`AiSystemBlock` + `cache_control: .ephemeral`) | Put the large fixed diagnostic rulebook in the cached base block; per-request images/metadata are the uncached user message. |
| Provider env resolution (`ANTHROPIC_API_KEY`, `AZURE_AI_FOUNDRY_ENDPOINT`, `MODEL_NAME`) | Default `MODEL_NAME=claude-sonnet-5` (vision-capable; replaces stale `claude-sonnet-4-6`). Configurable per env like ticket-api. |
| Microsoft Graph email sender (`GRAPH_EMAIL_SETUP_GUIDE.md`) | Send the intake report PDF/summary. Replaces client-side EmailJS. |
| Dockerfile + docker-compose patterns | Combined image also serves the built SPA (Vapor static file middleware / `Public/`). |
| CORS config | Allow the SPA origin(s). |

**Routes**

| Route | Purpose |
|-------|---------|
| `POST /api/login` | Compare password against `APP_PASSWORD_HASH`; set signed HTTP-only session cookie |
| `POST /api/analyze` | Auth-gated. Build Messages request (cached system prompt + image blocks + metadata) via `AiClient`, return JSON |
| `POST /api/email` | Auth-gated. Send report via Microsoft Graph |
| `GET /*` | Serve built SPA files with `index.html` fallback |

**Auth middleware** protects `/api/analyze` and `/api/email`: no valid session cookie → 401.
(Note: ticket-api uses Auth0 JWT + an M2M `X-Api-Key` middleware. ProbeIntake uses the simpler
shared-password gate the user chose — see Open Items for the Auth0-reuse alternative.)

**The diagnostic system prompt** (repair rules, bundling logic, JSON output schema) is lifted
verbatim from the HTML (lines ~590–631) into a Swift string constant / resource file, placed
in the cached base block.

### 3.3 Configuration (all server-side env vars)

```
ANTHROPIC_API_KEY        # the key, never leaves the proxy
AZURE_AI_FOUNDRY_ENDPOINT# optional: use Azure-hosted Claude instead of direct Anthropic
MODEL_NAME               # default claude-sonnet-5, swappable without code change
APP_PASSWORD_HASH        # hashed shared password for the gate
SESSION_SECRET           # signs the session cookie
GRAPH_* (email creds)    # Microsoft Graph email, per ticket-api's setup guide
CORS_ALLOWED_ORIGINS     # SPA origins for the deployed (two-app) case
```

Local: `.env` mounted into the container. Cloud: host's secret store.

---

## 4. Data Flow

```
Browser (SPA)                Proxy (Vapor, AiClient)          Provider
─────────────                ───────────────────────          ────────
login password  ───POST────▶ compare hash, set cookie
                 ◀──cookie──
capture + meta  ───POST────▶ verify cookie
 (base64 imgs)               AiClient.send(images + meta,
                             cached rulebook, key)     ───────▶ Messages API
                 ◀──JSON──── ◀──────────────────────────────────  JSON
render + PDF
email request   ───POST────▶ verify cookie, send via MS Graph ─▶ (mailbox)
```

---

## 5. Hosting & Updates

### Local (primary): one container

`docker compose up` runs the Vapor proxy, which serves both the SPA and the `/api` routes on
one port. Techs open `http://<box-ip>:PORT`. Runs on any Linux box (the Vapor image is Linux);
hardware is not yet known and this design does not require a specific one.

**Auto-updates:** a **Watchtower** sidecar watches the image registry; CI on `git push` builds
and pushes a new image, Watchtower pulls it and restarts. No SSH for routine updates.

### Cloud (later): two apps, same code

- `app/` (static SPA) → Azure Static Web Apps (matches `avconn`).
- `proxy/` (Vapor container) → Azure Container Apps (matches `ticket-api`'s Azure alignment).
- `staticwebapp.config.json` rewrites `/api/*` to the proxy origin.

Because `app/` and `proxy/` are separate packages from day one, the split is a deploy-config
change, not a rewrite.

---

## 6. Error Handling

Reuse `ticket-api`'s `AiError` mapping (`transport`, `rateLimited(retryAfter:)`, `parseFailed`):

- **Provider errors** (rate limit, transport): mapped to clean JSON `{ error: { message } }`;
  the SPA renders the message (preserves the HTML's `renderError` UX).
- **Malformed model JSON:** proxy attempts the same `{`…`}` slice the HTML does; on failure
  returns raw text so the SPA can show it (`renderRaw` behavior preserved).
- **Auth failures:** 401 → SPA redirects to `/login`.
- **Provider unset:** 503 (matches `AiClient`'s "nil client" contract).
- **Email failures:** surfaced to the SPA with the Graph error message.

---

## 7. Testing

- **Proxy (Swift, VaporTesting — same as ticket-api):**
  - Auth middleware: cookie present / absent / tampered → 200 / 401 / 401.
  - `/api/analyze`: with a mocked provider `Client`, verify the request carries the key, the
    cached rulebook block, and **image content blocks**; verify JSON passthrough + error map.
  - `/api/email`: mocked Graph client, verify payload + error surfacing.
  - Regression on the `AiMessage` content-block encoding (text-only vs image+text).
- **App (Vitest, colocated per route like `avconn`):**
  - Login flow, capture/thumbnail logic, results rendering from a fixture JSON, PDF smoke test.
- **Integration smoke:** one end-to-end run with a sample probe image → parseable JSON.

---

## 8. Resolved Decisions & Remaining Items

**Resolved (2026-07-08):**

- **Auth:** shared-password gate (signed HTTP-only session cookie). Auth0 reuse was considered
  and declined in favor of simplicity for a trusted shop.
- **Provider:** **Azure AI Foundry** (Azure-hosted Claude), via `AZURE_AI_FOUNDRY_ENDPOINT` —
  aligns with the rest of the Azure stack. `AiClient` already supports it; the code appends
  `/anthropic/v1` to the endpoint if not present, and reuses `ANTHROPIC_API_KEY` as the auth
  key unless `AZURE_AI_FOUNDRY_API_KEY` is set (same contract as ticket-api).
- **Default model:** `MODEL_NAME=claude-sonnet-5` (vision-capable), swappable per env.

**Remaining (settle during planning):**

- **Image registry** for Watchtower (GHCR / Azure Container Registry) + the CI trigger.
- **Git:** the `ProbeIntake` directory is not yet a git repo; initialized with the monorepo
  scaffold so the design doc and code are versioned and CI can build images.
