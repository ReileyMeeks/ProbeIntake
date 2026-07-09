# Avante Probe Intake

An AI-assisted intake tool for an ultrasound-probe repair lab. A technician photographs an incoming
probe (by zone) and its evaluation form; the app returns structured findings and a repair quote, then
exports a PDF or emails it. Migrated from a single-file HTML prototype into a small SvelteKit app plus
a secrets-holding backend proxy.

## Why the proxy

The original HTML called the model API **directly from the browser**, which exposed the API key to
anyone who opened the page. This version keeps the key on the server: the browser talks only to the
proxy, and the proxy holds the credentials and calls the model. The key never reaches the client.

## Architecture

```
Browser ── SvelteKit SPA (app/) ──HTTP──▶ Vapor proxy (proxy/) ──▶ Azure AI Foundry (Claude)
             static, no secrets            holds all secrets,          Anthropic Messages API
                                           shared-password gate,
                                           also serves the SPA
```

One Docker/OCI image serves **both** the SPA and the `/api` on port **8080**.

- **`app/`** — SvelteKit static SPA (`adapter-static`), Svelte 5 runes, TypeScript, Vitest.
  Interactive probe-schematic capture (click a zone to add its photo), PDF inspection-form upload,
  intake → quote view, PDF export + email.
- **`proxy/`** — Vapor 4 (Swift 6), stateless. Routes:
  - `POST /api/login` — shared-password login (Bcrypt), sets a session cookie
  - `GET  /api/session` — session check (used by the SPA's login guard)
  - `POST /api/analyze` — relays probe/form images + metadata to the model, returns findings + quote
  - `POST /api/extract` — reads the uploaded form, returns the probe's ID fields (auto-fills intake)
  - `POST /api/email` — emails the report via Microsoft Graph
  - serves the built SPA (static files + SPA fallback)

## Quick start (container)

Full details — including the Apple `container` framework vs Docker, and the per-container-IP gotcha —
are in **[DOCKER.md](DOCKER.md)**.

```sh
# 1. shared-password hash → put in .env as APP_PASSWORD_HASH
scripts/hash-password.sh 'your-password'

# 2. build + run (Apple container)
container system start
container build -t probe-intake:latest .
container run -d --name probe-intake --env-file .env probe-intake:latest
container ls        # note the container IP, then open http://<ip>:8080

# ...or Docker
docker build -t probe-intake:latest .
docker run --rm -p 8080:8080 --env-file .env probe-intake:latest   # http://localhost:8080
```

Log in with your password (the repo's sample `.env` ships a hash for the test password
**`avante-test`**), then: upload the eval form (fields auto-fill), add a photo per probe zone, and
click **Analyze probe**.

## Configuration (`.env`, git-ignored)

| Variable | Required | Notes |
|---|---|---|
| `AZURE_AI_FOUNDRY_ENDPOINT` | yes* | e.g. `https://<resource>.openai.azure.com` |
| `AZURE_AI_FOUNDRY_API_KEY` | yes* | falls back to `ANTHROPIC_API_KEY` |
| `MODEL_NAME` | no | default `claude-sonnet-5` |
| `APP_PASSWORD_HASH` | yes | Bcrypt hash from `scripts/hash-password.sh` |
| `AI_PROVIDER` | no | `azure_ai_foundry` (default) or `anthropic` |
| `ANTHROPIC_API_KEY` | no | used when `AI_PROVIDER=anthropic` |
| `GRAPH_TENANT_ID` / `GRAPH_CLIENT_ID` / `GRAPH_CLIENT_SECRET` / `GRAPH_MAILBOX` | no | Microsoft Graph email; without all four, `/api/email` returns 503 |

\* Or set `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` to call Anthropic directly instead of Azure.
There is no `SESSION_SECRET` — sessions use an in-memory store.

## Local development (no container)

Two processes. Export the env so the Swift proxy can read it, then run each:

```sh
set -a; . ./.env; set +a           # exports every var (a plain `source` won't reach the child process)
cd proxy && swift run ProbeProxy serve --env production --hostname 0.0.0.0 --port 8080
# in a second terminal:
cd app && npm run dev              # http://localhost:5173, proxying /api
```

## Testing

```sh
cd proxy && swift test             # backend
cd app   && npm test               # frontend (Vitest)
cd app   && npm run build && npm run check && npm run lint
```

## Test data

`FormImages/` holds a real intake set (Work Order WO0341463): probe photos to drop on each zone and
`WO0341463 IVIF.pdf` for the inspection-form upload. See the in-app zone hints, or the mapping notes
in the project history.

## Status

The app is complete and has been verified end-to-end against live Azure AI Foundry (login, form
extraction, analysis, quote). Not yet set up: a cloud two-app deployment (static SPA on a CDN + the
proxy as a container service) — the code is structured for it (the two packages deploy independently),
but the hosting config is a separate step.
