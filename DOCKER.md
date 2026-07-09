# Running Probe Intake in a container

One image serves **both** the SvelteKit SPA and the `/api` proxy on port **8080**. The Anthropic/
Azure key stays inside the container — it never reaches the browser.

Works with Apple's **`container`** framework or with Docker (commands for both below).

---

## 1. Create the shared-password hash

The app is protected by one shared password. You store a **Bcrypt hash** of it (never the plaintext)
in `APP_PASSWORD_HASH`.

```sh
scripts/hash-password.sh 'your-shared-password'
```

That prints a line like `$2y$10$abc...`. Copy it into `.env` (see next step).

> The repo's `.env` already has a hash for the **test password `avante-test`** so you can build and
> run immediately. Replace it with your own before real use.

---

## 2. The `.env` file

The proxy reads its config from environment variables. `.env` (git-ignored) at the repo root:

```sh
# --- Model provider: Azure AI Foundry (Anthropic-compatible) ---
AZURE_AI_FOUNDRY_ENDPOINT=https://<resource>.openai.azure.com
AZURE_AI_FOUNDRY_API_KEY=<your key>
MODEL_NAME=claude-sonnet-5           # optional; this is the default

# --- Shared login ---
APP_PASSWORD_HASH=$2y$10$...          # from step 1

# --- Email (optional) — Microsoft Graph. Without all four, /api/email returns 503. ---
# GRAPH_TENANT_ID=
# GRAPH_CLIENT_ID=
# GRAPH_CLIENT_SECRET=
# GRAPH_MAILBOX=intake@yourdomain.com
```

Notes
- `AI_PROVIDER` defaults to `azure_ai_foundry`; set it to `anthropic` (and `ANTHROPIC_API_KEY`) to
  call Anthropic directly instead.
- There is **no** `SESSION_SECRET` to set — sessions use an in-memory store.

---

## 3. Build & run — Apple `container`

```sh
container system start                 # once per boot, if not already running
container build -t probe-intake:latest .
container run -d --name probe-intake --env-file .env probe-intake:latest
```

**Access — important:** Apple's `container` framework gives each container its **own IP** on a
private subnet; it does **not** forward `-p 8080` to `localhost` the way Docker does. Find the IP:

```sh
container ls          # → e.g. probe-intake  ...  running  192.168.64.3/24  ...
```

Then open **http://192.168.64.3:8080** (use your container's IP), and log in with your password
(test: `avante-test`). The proxy listens on `:8080` inside the container, so it's `<container-ip>:8080`.

Stop/remove when done: `container stop probe-intake && container rm probe-intake`.
To rebuild after code changes: `container stop probe-intake && container rm probe-intake`, then
`container build …` and `container run …` again.

## 3b. Build & run — Docker (equivalent)

```sh
docker build -t probe-intake:latest .
docker run --rm -p 8080:8080 --env-file .env probe-intake:latest
```

---

## 4. Quick smoke test

Set `HOST` to `localhost` (Docker) or your container's IP (Apple `container`, from `container ls`):

```sh
HOST=192.168.64.3      # Apple container IP; or `localhost` for Docker
curl -s $HOST:8080/health          # → ok
# log in, keep the session cookie:
curl -s -c cookies.txt -X POST $HOST:8080/api/login \
  -H 'content-type: application/json' -d '{"password":"avante-test"}' -o /dev/null -w '%{http_code}\n'
# → 200
```

Or just use the UI: capture a probe photo per zone, add the eval form, click **Analyze probe**.

---

## 5. Running WITHOUT a container (local dev)

Two processes. First export the env so the Swift proxy can read it:

```sh
# from the repo root — load every var from .env into the current shell
set -a; . ./.env; set +a

# start the proxy (serves API + the built SPA if app/build is copied into proxy/Public,
# but for dev you usually run the SPA separately — see below)
cd proxy
swift run ProbeProxy serve --env production --hostname 0.0.0.0 --port 8080
```

`set -a; . ./.env; set +a` marks all variables for export, sources the file, then turns that off —
so `AZURE_AI_FOUNDRY_*`, `APP_PASSWORD_HASH`, etc. become real environment variables the proxy sees
via `Environment.get(...)`. (A plain `source .env` would set them as shell variables only, NOT export
them to the child process — hence `set -a`.)

For live frontend work, run the SPA dev server in a second terminal and point it at the proxy:

```sh
cd app
npm run dev            # http://localhost:5173 ; API calls go to /api on the same origin
```

(In the container, the proxy serves the built SPA directly, so there's only one origin/port.)

---

## What updates look like later

Rebuild the image and re-run it. For hands-off updates on a always-on box, add a Watchtower-style
sidecar that re-pulls a published image — that's the cloud/deploy step, separate from this local flow.
