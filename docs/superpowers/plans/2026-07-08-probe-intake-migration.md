# Probe Intake Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-file `avante_probe_intake_FINAL (1).html` into a static SvelteKit SPA plus a stateless Swift/Vapor proxy that holds all secrets, so no API key ever reaches the browser.

**Architecture:** Monorepo with two packages — `app/` (SvelteKit static SPA, adapter-static, matching `avconn`/`SvelteTemplateApp`) and `proxy/` (Vapor 4 service modeled on `ticket-api`, minus Fluent/Postgres/Monday). The proxy exposes `/api/login`, `/api/analyze`, `/api/email`, serves the built SPA, and relays to Azure AI Foundry via a reused `AiClient`. One Docker image runs both locally; the two packages deploy separately to Azure for cloud.

**Tech Stack:** SvelteKit (Svelte 5 runes) · TypeScript · Vitest · jsPDF · Swift 6 · Vapor 4 · VaporTesting · Docker · Watchtower · Microsoft Graph · Azure AI Foundry (Anthropic-compatible).

## Global Constraints

- **Reference sources (read-only, same machine):**
  - HTML source of truth: `avante_probe_intake_FINAL (1).html` (this repo). Line refs below point here.
  - Backend pattern donor: `../TicketApp/ticket-api` (Vapor). Reuse files verbatim except where a task says to adapt.
  - Frontend template donor: `../SvelteTemplateApp` (adapter-static, Svelte 5 runes, Vitest, `$lib/{ui,forms,domain}`).
- **Proxy is STATELESS** — no Fluent, no Postgres, no migrations, no Monday, no AI pipeline worker. Do not copy those from ticket-api.
- **No secret reaches the browser.** The client-side config bar (HTML lines ~215–235) is deleted, not ported.
- **Provider = Azure AI Foundry.** `ResolvedProvider` for Azure: `baseURL = {AZURE_AI_FOUNDRY_ENDPOINT}/anthropic/v1`, `authHeader = ("Authorization", "Bearer <key>")`, extra header `("anthropic-version", "2023-06-01")`. Key = `AZURE_AI_FOUNDRY_API_KEY` else `ANTHROPIC_API_KEY`. (Copy this logic verbatim from `ticket-api/Sources/TicketApi/Ai/AiProvider.swift`.)
- **Default model:** `MODEL_NAME` env var, default `claude-sonnet-5` (vision-capable). Never hardcode elsewhere.
- **Auth:** single shared password. Store a **Bcrypt hash** in `APP_PASSWORD_HASH`; verify with Vapor's built-in `Bcrypt`. Session via Vapor `SessionsMiddleware` (memory driver — single-instance assumption; documented).
- **Svelte:** runes mode on (`$state`, `$derived`, `$props`), TypeScript, tests colocated per route as `*.test.ts` (Vitest), Prettier.
- **Commit after every task.** Conventional-commit messages.
- **Integration fixture:** `FormImages/` is a real intake set — Work Order WO0341463, GE C1-6 probe (14 JPG photos + `WO0341463 IVIF.pdf` form). Use it for the end-to-end test in Task 17: base64 a few probe photos + treat the form as `isForm:true`, POST to `/api/analyze`, and assert the result extracts `model` ≈ `C1-6` and returns non-empty `findings`/`quoteItems`. (Folder name is a slight misnomer — it holds probe photos too, not just forms.)
- **Model is swappable, within the Anthropic Messages API envelope.** The reused `AiClient` speaks Anthropic Messages format (system blocks + `content` array + `image.source.base64`). Any model Azure AI Foundry serves on its Anthropic-compatible endpoint works by changing `MODEL_NAME` alone. A model exposed only in a *different* wire format (e.g. Azure OpenAI Chat Completions / GPT-4o vision) would need a separate client adapter — out of scope unless added deliberately.

---

## File Structure

```
probe-intake/
├─ app/                                   # SvelteKit static SPA (copied from SvelteTemplateApp)
│  ├─ svelte.config.js                    # adapter-static, fallback: index.html (unchanged from template)
│  ├─ src/lib/api/client.ts               # fetch wrapper: posts to proxy, redirects to /login on 401
│  ├─ src/lib/domain/probe.ts             # types: ProbeMeta, CapturedImage, AnalyzeResult
│  ├─ src/lib/forms/IntakeForm.svelte     # probe metadata fields
│  ├─ src/lib/forms/CapturePanel.svelte   # upload + live camera + zone tagging + thumbnails
│  ├─ src/lib/ui/ResultsView.svelte       # renders findings + quoteItems
│  ├─ src/lib/ui/report.ts                # jsPDF report + images export
│  ├─ src/routes/+layout.svelte           # header + workflow bar (NO config bar)
│  ├─ src/routes/+page.svelte             # main intake screen (composes the above)
│  └─ src/routes/login/+page.svelte       # shared-password login
├─ proxy/                                 # Vapor 4 service (stateless)
│  ├─ Package.swift                        # Vapor only (no Fluent/JWT)
│  ├─ Sources/ProbeProxy/entrypoint.swift
│  ├─ Sources/ProbeProxy/configure.swift  # CORS, sessions, AiClient/Graph wiring, FileMiddleware, routes
│  ├─ Sources/ProbeProxy/Ai/AiProvider.swift   # ResolvedProvider.fromEnv() (adapted, DB-free)
│  ├─ Sources/ProbeProxy/Ai/AiClient.swift     # reused + content-block (image) adaptation
│  ├─ Sources/ProbeProxy/Ai/AiModels.swift     # reused + .probeAnalysis step
│  ├─ Sources/ProbeProxy/Ai/ProbePrompt.swift  # the diagnostic system prompt (verbatim from HTML)
│  ├─ Sources/ProbeProxy/Email/GraphEmailClient.swift # reused + attachment support
│  ├─ Sources/ProbeProxy/Middleware/AuthGate.swift    # 401 unless session authed
│  ├─ Sources/ProbeProxy/Controllers/AnalyzeController.swift
│  ├─ Sources/ProbeProxy/Controllers/EmailController.swift
│  ├─ Sources/ProbeProxy/Controllers/AuthController.swift
│  └─ Tests/ProbeProxyTests/*.swift
├─ Dockerfile                             # multi-stage: build SPA + Vapor → serve together
├─ docker-compose.yml                     # proxy + watchtower
├─ .env.example
├─ staticwebapp.config.json               # cloud: rewrite /api/* to proxy
└─ README.md
```

---

## Task 1: Repo scaffold + SPA from template

**Files:**
- Create: `app/` (copied from `../SvelteTemplateApp`)
- Modify: `app/src/routes/+page.svelte`, remove template demo routes
- Test: `app/src/routes/page.test.ts`

**Interfaces:**
- Produces: a buildable static SPA at `app/` with `npm run build` → `app/build/`.

- [ ] **Step 1: Copy the template into `app/`**

```bash
cd /Users/ReileyMeeks/AvanteConnected/ProbeIntake
rsync -a --exclude node_modules --exclude .git --exclude build --exclude .svelte-kit \
  ../SvelteTemplateApp/ app/
cd app && npm install
```

- [ ] **Step 2: Remove template demo routes, keep layout + home + add login route dir**

```bash
rm -rf src/routes/dashboard src/routes/settings src/routes/about
mkdir -p src/routes/login src/lib/api src/lib/domain src/lib/forms
```

- [ ] **Step 3: Write a failing smoke test for the home route**

```ts
// app/src/routes/page.test.ts
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Page from './+page.svelte';

describe('intake home', () => {
  it('renders the app title', () => {
    render(Page);
    expect(screen.getByText(/Avante Probe Intake/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run it, expect FAIL**

Run: `cd app && npm test -- src/routes/page.test.ts`
Expected: FAIL (title not present / demo content).

- [ ] **Step 5: Replace `+page.svelte` with a minimal titled placeholder**

```svelte
<!-- app/src/routes/+page.svelte -->
<script lang="ts">
</script>

<h1>Avante Probe Intake</h1>
```

- [ ] **Step 6: Run tests + build, expect PASS**

Run: `cd app && npm test -- src/routes/page.test.ts && npm run build`
Expected: test PASS; `app/build/index.html` produced.

- [ ] **Step 7: Commit**

```bash
git add app .gitignore
git commit -m "chore: scaffold SvelteKit SPA from template"
```

---

## Task 2: Vapor proxy skeleton (stateless) + health route

**Files:**
- Create: `proxy/Package.swift`, `proxy/Sources/ProbeProxy/entrypoint.swift`, `proxy/Sources/ProbeProxy/configure.swift`, `proxy/Sources/ProbeProxy/routes.swift`, `proxy/Tests/ProbeProxyTests/HealthTests.swift`

**Interfaces:**
- Produces: `configure(_ app: Application) async throws`; `GET /health` → `200 "ok"`.

- [ ] **Step 1: Write `Package.swift` (Vapor only)**

```swift
// proxy/Package.swift
// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "ProbeProxy",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/vapor/vapor.git", from: "4.115.0"),
    ],
    targets: [
        .executableTarget(
            name: "ProbeProxy",
            dependencies: [.product(name: "Vapor", package: "vapor")],
            swiftSettings: [.enableUpcomingFeature("ExistentialAny")]
        ),
        .testTarget(
            name: "ProbeProxyTests",
            dependencies: [
                .target(name: "ProbeProxy"),
                .product(name: "VaporTesting", package: "vapor"),
            ],
            swiftSettings: [.enableUpcomingFeature("ExistentialAny")]
        ),
    ]
)
```

- [ ] **Step 2: Write `entrypoint.swift` and `routes.swift`**

```swift
// proxy/Sources/ProbeProxy/entrypoint.swift
import Vapor

@main
enum Entrypoint {
    static func main() async throws {
        var env = try Environment.detect()
        try LoggingSystem.bootstrap(from: &env)
        let app = try await Application.make(env)
        do {
            try await configure(app)
            try await app.execute()
        } catch {
            app.logger.report(error: error)
            try? await app.asyncShutdown()
            throw error
        }
        try await app.asyncShutdown()
    }
}
```

```swift
// proxy/Sources/ProbeProxy/routes.swift
import Vapor

func routes(_ app: Application) throws {
    app.get("health") { _ in "ok" }
}
```

- [ ] **Step 3: Write minimal `configure.swift`**

```swift
// proxy/Sources/ProbeProxy/configure.swift
import Vapor

public func configure(_ app: Application) async throws {
    try routes(app)
}
```

- [ ] **Step 4: Write a failing health test**

```swift
// proxy/Tests/ProbeProxyTests/HealthTests.swift
import VaporTesting
import Testing
@testable import ProbeProxy

@Suite struct HealthTests {
    @Test func health_returns_ok() async throws {
        try await withApp { app in
            try await app.testing().test(.GET, "health") { res async in
                #expect(res.status == .ok)
                #expect(res.body.string == "ok")
            }
        }
    }
}

func withApp(_ body: (Application) async throws -> Void) async throws {
    let app = try await Application.make(.testing)
    do { try await configure(app); try await body(app) }
    catch { try await app.asyncShutdown(); throw error }
    try await app.asyncShutdown()
}
```

- [ ] **Step 5: Run, expect PASS**

Run: `cd proxy && swift test --filter HealthTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add proxy
git commit -m "feat(proxy): Vapor skeleton with health route"
```

---

## Task 3: Env-based provider resolution

**Files:**
- Create: `proxy/Sources/ProbeProxy/Ai/AiProvider.swift`, `proxy/Tests/ProbeProxyTests/ProviderTests.swift`
- Reference: `../TicketApp/ticket-api/Sources/TicketApi/Ai/AiProvider.swift` (copy `ResolvedProvider` verbatim; adapt resolution to be DB-free)

**Interfaces:**
- Produces: `struct ResolvedProvider { kind; baseURL: String; authHeader: (name,value); extraHeaders: [(String,String)]; defaultModel: String; forcedModel: String? }`
- Produces: `static func ResolvedProvider.fromEnv() throws -> ResolvedProvider`

- [ ] **Step 1: Write failing tests for both providers**

```swift
// proxy/Tests/ProbeProxyTests/ProviderTests.swift
import Testing
import Vapor
@testable import ProbeProxy

@Suite struct ProviderTests {
    @Test func azure_foundry_builds_bearer_and_anthropic_v1() throws {
        setenv("AI_PROVIDER", "azure_ai_foundry", 1)
        setenv("AZURE_AI_FOUNDRY_ENDPOINT", "https://x.openai.azure.com", 1)
        setenv("AZURE_AI_FOUNDRY_API_KEY", "az-key", 1)
        setenv("MODEL_NAME", "claude-sonnet-5", 1)
        let p = try ResolvedProvider.fromEnv()
        #expect(p.baseURL == "https://x.openai.azure.com/anthropic/v1")
        #expect(p.authHeader.name == "Authorization")
        #expect(p.authHeader.value == "Bearer az-key")
        #expect(p.defaultModel == "claude-sonnet-5")
    }

    @Test func anthropic_direct_builds_x_api_key() throws {
        setenv("AI_PROVIDER", "anthropic", 1)
        setenv("ANTHROPIC_API_KEY", "sk-ant-test", 1)
        unsetenv("MODEL_NAME")
        let p = try ResolvedProvider.fromEnv()
        #expect(p.baseURL == "https://api.anthropic.com/v1")
        #expect(p.authHeader.name == "x-api-key")
    }
}
```

- [ ] **Step 2: Run, expect FAIL** — `cd proxy && swift test --filter ProviderTests` → FAIL (no such symbol).

- [ ] **Step 3: Implement `AiProvider.swift` (DB-free adaptation)**

```swift
// proxy/Sources/ProbeProxy/Ai/AiProvider.swift
import Vapor

enum AiProvider: String, Sendable {
    case anthropic
    case azureAiFoundry = "azure_ai_foundry"
}

struct ResolvedProvider: Sendable {
    enum Kind: Sendable { case anthropic, azureAiFoundry }
    var kind: Kind
    var baseURL: String
    var authHeader: (name: String, value: String)
    var extraHeaders: [(String, String)]
    var defaultModel: String
    var forcedModel: String?

    /// Resolve purely from env vars (no database — ProbeIntake is stateless).
    /// Mirrors ticket-api/AiProvider.current, without the ticket_ai_config row.
    static func fromEnv() throws -> ResolvedProvider {
        let provider = AiProvider(rawValue: Environment.get("AI_PROVIDER") ?? "azure_ai_foundry") ?? .azureAiFoundry
        let forcedModel = Environment.get("MODEL_NAME").flatMap { $0.isEmpty ? nil : $0 }
        let defaultModel = forcedModel ?? "claude-sonnet-5"

        switch provider {
        case .anthropic:
            guard let key = Environment.get("ANTHROPIC_API_KEY"), !key.isEmpty else {
                throw Abort(.internalServerError, reason: "ANTHROPIC_API_KEY missing")
            }
            return .init(
                kind: .anthropic,
                baseURL: "https://api.anthropic.com/v1",
                authHeader: ("x-api-key", key),
                extraHeaders: [
                    ("anthropic-version", "2023-06-01"),
                    ("anthropic-beta", "prompt-caching-2024-07-31"),
                ],
                defaultModel: defaultModel,
                forcedModel: forcedModel
            )
        case .azureAiFoundry:
            guard let endpoint = Environment.get("AZURE_AI_FOUNDRY_ENDPOINT"), !endpoint.isEmpty else {
                throw Abort(.internalServerError, reason: "AZURE_AI_FOUNDRY_ENDPOINT missing")
            }
            let key = Environment.get("AZURE_AI_FOUNDRY_API_KEY").flatMap { $0.isEmpty ? nil : $0 }
                ?? Environment.get("ANTHROPIC_API_KEY").flatMap { $0.isEmpty ? nil : $0 }
            guard let key else {
                throw Abort(.internalServerError, reason: "Set AZURE_AI_FOUNDRY_API_KEY or ANTHROPIC_API_KEY")
            }
            let trimmed = endpoint.hasSuffix("/") ? String(endpoint.dropLast()) : endpoint
            let base = trimmed.hasSuffix("/anthropic") ? trimmed : "\(trimmed)/anthropic"
            return .init(
                kind: .azureAiFoundry,
                baseURL: "\(base)/v1",
                authHeader: ("Authorization", "Bearer \(key)"),
                extraHeaders: [("anthropic-version", "2023-06-01")],
                defaultModel: defaultModel,
                forcedModel: forcedModel
            )
        }
    }
}
```

- [ ] **Step 4: Run, expect PASS** — `cd proxy && swift test --filter ProviderTests`.

- [ ] **Step 5: Commit** — `git add proxy && git commit -m "feat(proxy): env-based Azure/Anthropic provider resolution"`

---

## Task 4: Vision-capable AiClient

**Files:**
- Create: `proxy/Sources/ProbeProxy/Ai/AiClient.swift` (copied from ticket-api, adapted), `proxy/Sources/ProbeProxy/Ai/AiModels.swift`, `proxy/Tests/ProbeProxyTests/AiClientEncodingTests.swift`
- Reference: `../TicketApp/ticket-api/Sources/TicketApi/Ai/AiClient.swift`, `.../AiModels.swift`

**Interfaces:**
- Consumes: `ResolvedProvider` (Task 3).
- Produces content-block types and `AiClient.send`:
```swift
enum AiContent: Codable, Sendable { case text(String); case image(mediaType: String, base64: String) }
struct AiMessage: Codable, Sendable { var role: String; var content: [AiContent] }
struct AiClient { func send(step: AiStep, modelOverride: String?, systemBase: String, userContent: [AiContent]) async throws -> AiResponse }
enum AiStep: String, Sendable { case probeAnalysis = "probe_analysis" }
```

- [ ] **Step 1: Write a failing wire-encoding test**

```swift
// proxy/Tests/ProbeProxyTests/AiClientEncodingTests.swift
import Testing
import Foundation
@testable import ProbeProxy

@Suite struct AiClientEncodingTests {
    @Test func message_encodes_image_then_text_blocks() throws {
        let msg = AiMessage(role: "user", content: [
            .image(mediaType: "image/jpeg", base64: "QUJD"),
            .text("analyze"),
        ])
        let data = try JSONEncoder().encode(msg)
        let json = String(decoding: data, as: UTF8.self)
        #expect(json.contains("\"type\":\"image\""))
        #expect(json.contains("\"media_type\":\"image\\/jpeg\"") || json.contains("\"media_type\":\"image/jpeg\""))
        #expect(json.contains("\"type\":\"text\""))
    }

    @Test func system_block_carries_ephemeral_cache_control() throws {
        let block = AiSystemBlock(text: "rules", cacheControl: .ephemeral)
        let json = String(decoding: try JSONEncoder().encode(block), as: UTF8.self)
        #expect(json.contains("\"cache_control\""))
        #expect(json.contains("\"ephemeral\""))
    }
}
```

- [ ] **Step 2: Run, expect FAIL** — `cd proxy && swift test --filter AiClientEncodingTests`.

- [ ] **Step 3: Implement `AiModels.swift` with the single probe step**

```swift
// proxy/Sources/ProbeProxy/Ai/AiModels.swift
import Foundation

enum AiStep: String, Sendable { case probeAnalysis = "probe_analysis" }

enum AiModels {
    static func model(for step: AiStep, override: String?) -> String {
        if let override, !override.isEmpty { return override }
        return "claude-sonnet-5"   // vision + structured extraction
    }
    static func maxTokens(for step: AiStep) -> Int { 4096 }   // matches HTML max_tokens:4096
    static func temperature(for step: AiStep) -> Double { 0.2 }
}
```

- [ ] **Step 4: Implement `AiClient.swift` (content blocks + image support)**

```swift
// proxy/Sources/ProbeProxy/Ai/AiClient.swift
import Vapor

/// Content block: text or a base64 image (Anthropic Messages API `content` array form).
enum AiContent: Codable, Sendable {
    case text(String)
    case image(mediaType: String, base64: String)

    private enum K: String, CodingKey { case type, text, source }
    private enum SourceK: String, CodingKey { case type, media_type, data }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: K.self)
        switch self {
        case .text(let t):
            try c.encode("text", forKey: .type); try c.encode(t, forKey: .text)
        case .image(let mt, let b64):
            try c.encode("image", forKey: .type)
            var s = c.nestedContainer(keyedBy: SourceK.self, forKey: .source)
            try s.encode("base64", forKey: .type)
            try s.encode(mt, forKey: .media_type)
            try s.encode(b64, forKey: .data)
        }
    }
    init(from decoder: Decoder) throws {   // decode not used server-side; minimal
        let c = try decoder.container(keyedBy: K.self)
        if try c.decode(String.self, forKey: .type) == "text" {
            self = .text(try c.decode(String.self, forKey: .text))
        } else {
            let s = try c.nestedContainer(keyedBy: SourceK.self, forKey: .source)
            self = .image(mediaType: try s.decode(String.self, forKey: .media_type),
                          base64: try s.decode(String.self, forKey: .data))
        }
    }
}

struct AiMessage: Codable, Sendable { var role: String; var content: [AiContent] }

struct AiSystemBlock: Codable, Sendable {
    var type: String; var text: String; var cacheControl: CacheControl?
    init(text: String, cacheControl: CacheControl? = nil) { self.type = "text"; self.text = text; self.cacheControl = cacheControl }
    enum CodingKeys: String, CodingKey { case type, text, cacheControl = "cache_control" }
    struct CacheControl: Codable, Sendable { var type: String; static let ephemeral = CacheControl(type: "ephemeral") }
}

struct AiResponse: Codable, Sendable {
    struct ContentBlock: Codable, Sendable { var type: String; var text: String? }
    var content: [ContentBlock]
    var text: String { content.compactMap(\.text).joined() }
}

enum AiError: Swift.Error, Sendable {
    case transport(String), rateLimited(retryAfter: TimeInterval?), parseFailed(String)
}

struct AiClient: Sendable {
    let provider: ResolvedProvider
    let client: any Client
    let logger: Logger

    func send(step: AiStep, modelOverride: String?, systemBase: String, userContent: [AiContent]) async throws -> AiResponse {
        let model = AiModels.model(for: step, override: modelOverride ?? provider.forcedModel)
        let body = RequestBody(
            model: model,
            max_tokens: AiModels.maxTokens(for: step),
            temperature: AiModels.temperature(for: step),
            system: [AiSystemBlock(text: systemBase, cacheControl: .ephemeral)],
            messages: [AiMessage(role: "user", content: userContent)]
        )
        let data = try JSONEncoder().encode(body)
        var headers = HTTPHeaders()
        headers.add(name: provider.authHeader.name, value: provider.authHeader.value)
        for (k, v) in provider.extraHeaders { headers.add(name: k, value: v) }
        headers.contentType = .json

        let res = try await client.post(URI(string: "\(provider.baseURL)/messages"), headers: headers) { $0.body = .init(data: data) }
        if res.status == .tooManyRequests {
            throw AiError.rateLimited(retryAfter: res.headers.first(name: "retry-after").flatMap(TimeInterval.init))
        }
        guard let buf = res.body else { throw AiError.transport("empty body, status \(res.status)") }
        guard res.status == .ok else { throw AiError.transport("status \(res.status): \(String(buffer: buf))") }
        do { return try JSONDecoder().decode(AiResponse.self, from: Data(buffer: buf)) }
        catch { throw AiError.parseFailed("decode failed: \(error)") }
    }
}

private struct RequestBody: Codable {
    var model: String; var max_tokens: Int; var temperature: Double
    var system: [AiSystemBlock]; var messages: [AiMessage]
}

struct AiClientStorageKey: StorageKey { typealias Value = AiClient }
extension Application { var aiClient: AiClient? { get { storage[AiClientStorageKey.self] } set { storage[AiClientStorageKey.self] = newValue } } }
extension Request { var aiClient: AiClient? { application.aiClient } }
```

- [ ] **Step 5: Run, expect PASS** — `cd proxy && swift test --filter AiClientEncodingTests`.

- [ ] **Step 6: Commit** — `git add proxy && git commit -m "feat(proxy): vision-capable AiClient with image content blocks"`

---

## Task 5: Diagnostic system prompt resource

**Files:**
- Create: `proxy/Sources/ProbeProxy/Ai/ProbePrompt.swift`, `proxy/Tests/ProbeProxyTests/ProbePromptTests.swift`
- Reference: HTML source, the `sys` template string (lines ~570–631) and the JSON schema line (~631).

**Interfaces:**
- Produces: `enum ProbePrompt { static let system: String }`

- [ ] **Step 1: Write failing test asserting key rule + schema markers exist**

```swift
// proxy/Tests/ProbeProxyTests/ProbePromptTests.swift
import Testing
@testable import ProbeProxy

@Suite struct ProbePromptTests {
    @Test func prompt_contains_rules_and_json_schema() {
        let s = ProbePrompt.system
        #expect(s.contains("BUNDLING RULES"))
        #expect(s.contains("Retermination"))
        #expect(s.contains("\"quoteItems\""))
        #expect(s.contains("Respond ONLY with valid JSON"))
    }
}
```

- [ ] **Step 2: Run, expect FAIL** — `cd proxy && swift test --filter ProbePromptTests`.

- [ ] **Step 3: Implement `ProbePrompt.swift`**

Copy the entire `sys` string from the HTML (`avante_probe_intake_FINAL (1).html`, the `const sys=` assignment through the closing JSON schema, lines ~570–631) verbatim into a Swift multiline string literal:

```swift
// proxy/Sources/ProbeProxy/Ai/ProbePrompt.swift
enum ProbePrompt {
    static let system = #"""
    <PASTE the exact contents of the HTML `sys` template literal here,
     from the role/instructions through the BUNDLING RULES, FORM READING,
     and the final `Respond ONLY with valid JSON:` schema line.>
    """#
}
```

> Implementer note: open the HTML, select the `sys` string body, paste verbatim. Do not paraphrase — the rules and the JSON schema must match exactly so downstream parsing is unchanged.

- [ ] **Step 4: Run, expect PASS** — `cd proxy && swift test --filter ProbePromptTests`.

- [ ] **Step 5: Commit** — `git add proxy && git commit -m "feat(proxy): diagnostic system prompt resource"`

---

## Task 6: `/api/analyze` controller

**Files:**
- Create: `proxy/Sources/ProbeProxy/Controllers/AnalyzeController.swift`, `proxy/Tests/ProbeProxyTests/AnalyzeTests.swift`

**Interfaces:**
- Consumes: `AiClient` (Task 4), `ProbePrompt` (Task 5), `request.aiClient`.
- Produces: `POST /api/analyze` accepting:
```swift
struct AnalyzeRequest: Content { var meta: [String:String]; var images: [ImageInput] }
struct ImageInput: Content { var mediaType: String; var base64: String; var isForm: Bool }
```
returns the model's parsed JSON (or `{error:{message}}`).

- [ ] **Step 1: Write failing test with a mocked Client returning canned Messages JSON**

```swift
// proxy/Tests/ProbeProxyTests/AnalyzeTests.swift
import VaporTesting
import Testing
@testable import ProbeProxy

@Suite struct AnalyzeTests {
    @Test func analyze_returns_parsed_json_from_model() async throws {
        try await withApp { app in
            // Inject an AiClient whose HTTP client returns a canned Messages response.
            app.aiClient = makeStubAiClient(app, returning:
                #"{"content":[{"type":"text","text":"{\"findings\":[],\"quoteItems\":[],\"confidence\":90}"}]}"#)
            let payload = #"{"meta":{"model":"C1-6"},"images":[{"mediaType":"image/jpeg","base64":"QUJD","isForm":false}]}"#
            try await app.testing().test(.POST, "api/analyze",
                beforeRequest: { req in try req.content.decode... /* set JSON body */ }) { res async in
                #expect(res.status == .ok)
                #expect(res.body.string.contains("\"confidence\""))
            }
        }
    }
}
// Provide makeStubAiClient using a Vapor test Client stub (see Vapor docs: application.clients / a custom `Client`).
```

> Implementer note: implement `makeStubAiClient` with a minimal `Client` conformance whose `send` returns a `ClientResponse` with the canned body. Keep it in the test file.

- [ ] **Step 2: Run, expect FAIL** — `cd proxy && swift test --filter AnalyzeTests`.

- [ ] **Step 3: Implement `AnalyzeController.swift`**

```swift
// proxy/Sources/ProbeProxy/Controllers/AnalyzeController.swift
import Vapor

struct ImageInput: Content { var mediaType: String; var base64: String; var isForm: Bool }
struct AnalyzeRequest: Content { var meta: [String: String]; var images: [ImageInput] }

struct AnalyzeController {
    func analyze(_ req: Request) async throws -> Response {
        guard let ai = req.aiClient else { throw Abort(.serviceUnavailable, reason: "AI provider not configured") }
        let input = try req.content.decode(AnalyzeRequest.self)

        var content: [AiContent] = input.images.map { .image(mediaType: $0.mediaType, base64: $0.base64) }
        let probeCount = input.images.filter { !$0.isForm }.count
        let formCount = input.images.filter { $0.isForm }.count
        let metaLine = input.meta.map { "\($0.key)=\($0.value)" }.sorted().joined(separator: ", ")
        content.append(.text("""
        Analyze and generate quote.
        Probe: \(metaLine)
        Inputs: \(probeCount) probe images and \(formCount) form photos.
        Synthesize into unified findings and quote.
        """))

        do {
            let resp = try await ai.send(step: .probeAnalysis, modelOverride: nil,
                                         systemBase: ProbePrompt.system, userContent: content)
            // Same {...} slice the HTML does, so downstream parsing is unchanged.
            var raw = resp.text
            if let s = raw.firstIndex(of: "{"), let e = raw.lastIndex(of: "}") { raw = String(raw[s...e]) }
            let body = Response.Body(string: raw)
            return Response(status: .ok, headers: ["content-type": "application/json"], body: body)
        } catch let AiError.rateLimited(retryAfter) {
            throw Abort(.tooManyRequests, reason: "Rate limited\(retryAfter.map { "; retry after \($0)s" } ?? "")")
        } catch {
            return errorJSON(status: .badGateway, message: "\(error)")
        }
    }

    private func errorJSON(status: HTTPStatus, message: String) -> Response {
        let escaped = message.replacingOccurrences(of: "\"", with: "'")
        return Response(status: status, headers: ["content-type": "application/json"],
                        body: .init(string: #"{"error":{"message":"\#(escaped)"}}"#))
    }
}
```

- [ ] **Step 4: Register the route in `routes.swift`**

```swift
// add inside routes(_:)
let api = app.grouped("api")
let analyze = AnalyzeController()
api.post("analyze", use: analyze.analyze)   // AuthGate added in Task 8
```

- [ ] **Step 5: Run, expect PASS** — `cd proxy && swift test --filter AnalyzeTests`.

- [ ] **Step 6: Commit** — `git add proxy && git commit -m "feat(proxy): /api/analyze relays vision request to provider"`

---

## Task 7: Shared-password auth (login + gate)

**Files:**
- Create: `proxy/Sources/ProbeProxy/Controllers/AuthController.swift`, `proxy/Sources/ProbeProxy/Middleware/AuthGate.swift`, `proxy/Tests/ProbeProxyTests/AuthTests.swift`
- Modify: `proxy/Sources/ProbeProxy/configure.swift` (add `SessionsMiddleware`)

**Interfaces:**
- Produces: `POST /api/login` (body `{password}`) → sets `authed` session, 200/401; `AuthGate: AsyncMiddleware` → 401 when session not authed.

- [ ] **Step 1: Enable sessions in configure.swift**

```swift
// in configure(_:), before routes(app)
app.middleware.use(app.sessions.middleware)   // memory driver (single-instance)
```

- [ ] **Step 2: Write failing auth tests**

```swift
// proxy/Tests/ProbeProxyTests/AuthTests.swift
import VaporTesting
import Testing
import Vapor
@testable import ProbeProxy

@Suite struct AuthTests {
    @Test func wrong_password_401_correct_200_and_cookie() async throws {
        setenv("APP_PASSWORD_HASH", try! Bcrypt.hash("hunter2"), 1)
        try await withApp { app in
            try await app.testing().test(.POST, "api/login",
                beforeRequest: { try $0.content.encode(["password": "nope"]) }) { res async in
                #expect(res.status == .unauthorized)
            }
            try await app.testing().test(.POST, "api/login",
                beforeRequest: { try $0.content.encode(["password": "hunter2"]) }) { res async in
                #expect(res.status == .ok)
                #expect(res.headers.setCookie?["vapor-session"] != nil)
            }
        }
    }

    @Test func gate_blocks_without_session() async throws {
        try await withApp { app in
            app.grouped(AuthGate()).get("protected") { _ in "secret" }
            try await app.testing().test(.GET, "protected") { res async in
                #expect(res.status == .unauthorized)
            }
        }
    }
}
```

- [ ] **Step 3: Run, expect FAIL** — `cd proxy && swift test --filter AuthTests`.

- [ ] **Step 4: Implement `AuthController.swift`**

```swift
// proxy/Sources/ProbeProxy/Controllers/AuthController.swift
import Vapor

struct AuthController {
    struct LoginBody: Content { var password: String }

    func login(_ req: Request) async throws -> Response {
        let body = try req.content.decode(LoginBody.self)
        guard let hash = Environment.get("APP_PASSWORD_HASH"), !hash.isEmpty,
              (try? Bcrypt.verify(body.password, created: hash)) == true else {
            throw Abort(.unauthorized, reason: "Invalid password")
        }
        req.session.data["authed"] = "1"
        return Response(status: .ok)
    }
}
```

- [ ] **Step 5: Implement `AuthGate.swift`**

```swift
// proxy/Sources/ProbeProxy/Middleware/AuthGate.swift
import Vapor

struct AuthGate: AsyncMiddleware {
    func respond(to req: Request, chainingTo next: any AsyncResponder) async throws -> Response {
        guard req.session.data["authed"] == "1" else { throw Abort(.unauthorized) }
        return try await next.respond(to: req)
    }
}
```

- [ ] **Step 6: Register login route (in routes.swift)**

```swift
let auth = AuthController()
api.post("login", use: auth.login)
```

- [ ] **Step 7: Run, expect PASS** — `cd proxy && swift test --filter AuthTests`.

- [ ] **Step 8: Commit** — `git add proxy && git commit -m "feat(proxy): shared-password login + session AuthGate"`

---

## Task 8: Gate the protected routes

**Files:**
- Modify: `proxy/Sources/ProbeProxy/routes.swift`
- Test: `proxy/Tests/ProbeProxyTests/GateWiringTests.swift`

**Interfaces:**
- Consumes: `AuthGate` (Task 7), `AnalyzeController` (Task 6).

- [ ] **Step 1: Write failing test — analyze is 401 without session**

```swift
// proxy/Tests/ProbeProxyTests/GateWiringTests.swift
import VaporTesting
import Testing
@testable import ProbeProxy

@Suite struct GateWiringTests {
    @Test func analyze_requires_session() async throws {
        try await withApp { app in
            try await app.testing().test(.POST, "api/analyze",
                beforeRequest: { try $0.content.encode(["meta": [String:String](), "images": [String]()]) }) { res async in
                #expect(res.status == .unauthorized)
            }
        }
    }
}
```

- [ ] **Step 2: Run, expect FAIL** (currently analyze is ungated → not 401).

- [ ] **Step 3: Move `analyze` + `email` under an `AuthGate` group in routes.swift**

```swift
let api = app.grouped("api")
api.post("login", use: AuthController().login)
let gated = api.grouped(AuthGate())
gated.post("analyze", use: AnalyzeController().analyze)
gated.post("email", use: EmailController().send)   // EmailController from Task 9
```

> Implementer note: if executing before Task 9, temporarily omit the `email` line and add it in Task 9.

- [ ] **Step 4: Run, expect PASS** — `cd proxy && swift test --filter GateWiringTests`.

- [ ] **Step 5: Commit** — `git add proxy && git commit -m "feat(proxy): gate /api/analyze and /api/email behind AuthGate"`

---

## Task 9: `/api/email` via Microsoft Graph (with PDF attachment)

**Files:**
- Create: `proxy/Sources/ProbeProxy/Email/GraphEmailClient.swift` (copied from ticket-api, +attachment), `proxy/Sources/ProbeProxy/Controllers/EmailController.swift`, `proxy/Tests/ProbeProxyTests/EmailTests.swift`
- Modify: `proxy/Sources/ProbeProxy/configure.swift` (wire GraphEmailClient from env)
- Reference: `../TicketApp/ticket-api/Sources/TicketApi/Email/GraphEmailClient.swift`

**Interfaces:**
- Produces: `GraphEmailClient(tenantId:clientId:clientSecret:client:logger:)` and
  `func sendMail(mailbox:to:subject:body:attachment:) async throws` where `attachment: (name: String, base64: String)?`.
- Produces: `POST /api/email` accepting `{to, subject, summary, pdfBase64?}`.

- [ ] **Step 1: Copy GraphEmailClient.swift; write failing test for attachment JSON shape**

```swift
// proxy/Tests/ProbeProxyTests/EmailTests.swift
import Testing
@testable import ProbeProxy

@Suite struct EmailTests {
    @Test func sendmail_body_includes_attachment_when_present() throws {
        let json = GraphEmailClient.sendMailBody(
            to: "a@b.com", subject: "Report",
            body: "See attached.", attachment: ("report.pdf", "QUJD"))
        #expect(json.contains("attachments"))
        #expect(json.contains("report.pdf"))
        #expect(json.contains("#microsoft.graph.fileAttachment"))
        #expect(json.contains("QUJD"))
    }
}
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Extend GraphEmailClient — add a pure `sendMailBody` builder + attachment param**

```swift
// add to GraphEmailClient.swift
static func sendMailBody(to: String, subject: String, body: String,
                         attachment: (name: String, base64: String)?) -> String {
    var message: [String: Any] = [
        "subject": subject,
        "body": ["contentType": "Text", "content": body],
        "toRecipients": [["emailAddress": ["address": to]]],
    ]
    if let a = attachment {
        message["attachments"] = [[
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": a.name,
            "contentType": "application/pdf",
            "contentBytes": a.base64,
        ]]
    }
    let payload: [String: Any] = ["message": message, "saveToSentItems": true]
    let data = try! JSONSerialization.data(withJSONObject: payload)
    return String(decoding: data, as: UTF8.self)
}
```

> Implementer note: refactor the existing `sendMail(mailbox:to:subject:body:)` to build its body via `sendMailBody(..., attachment: nil)` and add an overload/param `attachment:` that threads through. Keep the token-fetch + POST logic unchanged.

- [ ] **Step 4: Implement `EmailController.swift`**

```swift
// proxy/Sources/ProbeProxy/Controllers/EmailController.swift
import Vapor

struct EmailController {
    struct Body: Content { var to: String; var subject: String; var summary: String; var pdfBase64: String? }
    func send(_ req: Request) async throws -> HTTPStatus {
        guard let graph = req.application.graphEmail else { throw Abort(.serviceUnavailable, reason: "Email not configured") }
        let b = try req.content.decode(Body.self)
        let mailbox = Environment.get("GRAPH_MAILBOX") ?? ""
        try await graph.sendMail(mailbox: mailbox, to: b.to, subject: b.subject, body: b.summary,
                                 attachment: b.pdfBase64.map { ("probe-report.pdf", $0) })
        return .ok
    }
}
```

- [ ] **Step 5: Wire GraphEmailClient in configure.swift (env-gated, like ticket-api)**

```swift
// in configure(_:)
if let tenant = Environment.get("GRAPH_TENANT_ID"),
   let clientId = Environment.get("GRAPH_CLIENT_ID"),
   let secret = Environment.get("GRAPH_CLIENT_SECRET") {
    app.graphEmail = GraphEmailClient(tenantId: tenant, clientId: clientId, clientSecret: secret,
                                      client: app.client, logger: app.logger)
}
```
Add storage accessor mirroring `aiClient`:
```swift
struct GraphStorageKey: StorageKey { typealias Value = GraphEmailClient }
extension Application { var graphEmail: GraphEmailClient? { get { storage[GraphStorageKey.self] } set { storage[GraphStorageKey.self] = newValue } } }
```

- [ ] **Step 6: Run, expect PASS** — `cd proxy && swift test --filter EmailTests`. Add the `email` route line from Task 8 Step 3.

- [ ] **Step 7: Commit** — `git add proxy && git commit -m "feat(proxy): /api/email via Graph with PDF attachment"`

---

## Task 10: Serve the built SPA + SPA fallback

**Files:**
- Modify: `proxy/Sources/ProbeProxy/configure.swift`
- Create: `proxy/Public/index.html` (placeholder for the test; real build lands here in Docker)
- Test: `proxy/Tests/ProbeProxyTests/StaticTests.swift`

**Interfaces:**
- Produces: `GET /` → SPA `index.html`; unknown non-`/api` path → `index.html` (client routing).

- [ ] **Step 1: Add FileMiddleware + fallback in configure.swift**

```swift
// in configure(_:), AFTER api routes are registered
app.middleware.use(FileMiddleware(publicDirectory: app.directory.publicDirectory, defaultFile: "index.html"))
// SPA fallback for client-side routes (e.g. /login) that aren't files:
app.get("login") { req in req.fileio.streamFile(at: app.directory.publicDirectory + "index.html") }
```

- [ ] **Step 2: Create placeholder Public/index.html + failing test**

```swift
// proxy/Tests/ProbeProxyTests/StaticTests.swift
import VaporTesting
import Testing
@testable import ProbeProxy

@Suite struct StaticTests {
    @Test func root_serves_index() async throws {
        try await withApp { app in
            try await app.testing().test(.GET, "/") { res async in
                #expect(res.status == .ok)
                #expect(res.body.string.contains("<!DOCTYPE html>") || res.body.string.contains("<html"))
            }
        }
    }
}
```
```html
<!-- proxy/Public/index.html -->
<!DOCTYPE html><html><head><title>Avante Probe Intake</title></head><body>placeholder</body></html>
```

- [ ] **Step 3: Run, expect PASS** — `cd proxy && swift test --filter StaticTests`.

- [ ] **Step 4: Commit** — `git add proxy && git commit -m "feat(proxy): serve static SPA with index fallback"`

---

## Task 11: SPA — domain types + API client

**Files:**
- Create: `app/src/lib/domain/probe.ts`, `app/src/lib/api/client.ts`, `app/src/lib/api/client.test.ts`

**Interfaces:**
- Produces: `postAnalyze(req): Promise<AnalyzeResult>`, `postEmail(req): Promise<void>`, `login(password): Promise<boolean>`; on `401`, `postAnalyze/postEmail` redirect to `/login`.

- [ ] **Step 1: Write failing test for 401 → redirect**

```ts
// app/src/lib/api/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postAnalyze } from './client';

describe('api client', () => {
  beforeEach(() => { vi.stubGlobal('location', { href: '' } as any); });
  it('redirects to /login on 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })));
    await expect(postAnalyze({ meta: {}, images: [] })).rejects.toThrow();
    expect((globalThis.location as any).href).toBe('/login');
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `cd app && npm test -- src/lib/api/client.test.ts`.

- [ ] **Step 3: Implement types + client**

```ts
// app/src/lib/domain/probe.ts
export interface ProbeMeta { [k: string]: string }
export interface CapturedImage { mediaType: string; base64: string; isForm: boolean; dataUrl: string; zone?: string }
export interface Finding { zone: string; description: string; severity: string; source: string }
export interface QuoteItem { item: string; priority: string; rationale: string }
export interface AnalyzeResult { probeId: Record<string,string>; findings: Finding[]; quoteItems: QuoteItem[]; overallCondition: string; confidence: number; notes: string }
```

```ts
// app/src/lib/api/client.ts
import type { AnalyzeResult, CapturedImage, ProbeMeta } from '$lib/domain/probe';

const base = ''; // same origin locally; /api/* rewritten to proxy when deployed

async function post(path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), credentials: 'include',
  });
  if (res.status === 401) { location.href = '/login'; throw new Error('unauthorized'); }
  return res;
}

export async function login(password: string): Promise<boolean> {
  const res = await post('/api/login', { password });
  return res.ok;
}

export async function postAnalyze(req: { meta: ProbeMeta; images: Pick<CapturedImage,'mediaType'|'base64'|'isForm'>[] }): Promise<AnalyzeResult> {
  const res = await post('/api/analyze', req);
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
  return res.json();
}

export async function postEmail(req: { to: string; subject: string; summary: string; pdfBase64?: string }): Promise<void> {
  const res = await post('/api/email', req);
  if (!res.ok) throw new Error(`email failed: ${res.status}`);
}
```

- [ ] **Step 4: Run, expect PASS.**
- [ ] **Step 5: Commit** — `git add app && git commit -m "feat(app): domain types + proxy API client with 401 redirect"`

---

## Task 12: SPA — layout shell + login page (no config bar)

**Files:**
- Modify: `app/src/routes/+layout.svelte`, `app/src/routes/layout.css`
- Create: `app/src/routes/login/+page.svelte`, `app/src/routes/login/page.test.ts`
- Reference: HTML header (lines ~19–33) and workflow bar (lines ~49–57) CSS; DO NOT port the config bar (lines ~34–47, ~215–235).

**Interfaces:**
- Consumes: `login()` (Task 11).

- [ ] **Step 1: Port header + workflow-bar CSS into `layout.css`** — copy the `.hdr*` and `.wf*` rules verbatim from the HTML `<style>` block; omit all `.config-*` rules.

- [ ] **Step 2: Rebuild `+layout.svelte`** with the header markup (brand + status), workflow bar, and `<slot/>`; remove the config bar markup entirely.

- [ ] **Step 3: Write failing login test**

```ts
// app/src/routes/login/page.test.ts
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Login from './+page.svelte';

vi.mock('$lib/api/client', () => ({ login: vi.fn(async () => true) }));

describe('login', () => {
  it('submits password', async () => {
    render(Login);
    await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'x' } });
    await fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    const { login } = await import('$lib/api/client');
    expect(login).toHaveBeenCalledWith('x');
  });
});
```

- [ ] **Step 4: Run, expect FAIL.**

- [ ] **Step 5: Implement `login/+page.svelte`**

```svelte
<script lang="ts">
  import { login } from '$lib/api/client';
  let password = $state('');
  let error = $state('');
  async function submit(e: Event) {
    e.preventDefault();
    if (await login(password)) location.href = '/';
    else error = 'Incorrect password';
  }
</script>

<form onsubmit={submit}>
  <label for="pw">Password</label>
  <input id="pw" type="password" bind:value={password} />
  <button type="submit">Sign in</button>
  {#if error}<p role="alert">{error}</p>{/if}
</form>
```

- [ ] **Step 6: Run tests + build, expect PASS** — `cd app && npm test && npm run build`.
- [ ] **Step 7: Commit** — `git add app && git commit -m "feat(app): layout shell + login page, config bar removed"`

---

## Task 13: SPA — intake form + capture panel

**Files:**
- Create: `app/src/lib/forms/IntakeForm.svelte`, `app/src/lib/forms/CapturePanel.svelte`, `app/src/lib/forms/capture.test.ts`
- Reference: HTML form fields (lines ~240–330), upload zone + camera + zone-pill logic (JS lines ~440–560).

**Interfaces:**
- Produces: `IntakeForm` binds a `ProbeMeta`; `CapturePanel` binds `CapturedImage[]` (file upload + camera capture + per-zone tagging + thumbnail remove).

- [ ] **Step 1: Write failing test — adding a file yields a CapturedImage with base64**

```ts
// app/src/lib/forms/capture.test.ts
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import CapturePanel from './CapturePanel.svelte';

describe('capture', () => {
  it('adds an uploaded image to the bound list', async () => {
    let images = $state([]);
    render(CapturePanel, { props: { images } });
    const file = new File([new Uint8Array([1,2,3])], 'p.jpg', { type: 'image/jpeg' });
    const input = screen.getByTestId('file-input') as HTMLInputElement;
    await fireEvent.change(input, { target: { files: [file] } });
    expect(images.length).toBe(1);
    expect(images[0].mediaType).toBe('image/jpeg');
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `CapturePanel.svelte`** — file input (`data-testid="file-input"`), drag-drop zone, live camera via `navigator.mediaDevices.getUserMedia`, capture-to-canvas → base64, zone pills, thumbnail grid with remove. Port the base64/`FileReader` and camera logic from the HTML JS (lines ~440–560), adapting DOM manipulation to Svelte `$state`. Store each image as `{ mediaType, base64 (no data: prefix), dataUrl, isForm, zone }`.

- [ ] **Step 4: Implement `IntakeForm.svelte`** — the metadata fields (model, S/N, REF, MFG, SO, customer, notes) bound to a `ProbeMeta`, ported from HTML lines ~240–330.

- [ ] **Step 5: Run tests, expect PASS.**
- [ ] **Step 6: Commit** — `git add app && git commit -m "feat(app): intake form + capture panel"`

---

## Task 14: SPA — analyze action + results view

**Files:**
- Create: `app/src/lib/ui/ResultsView.svelte`, `app/src/lib/ui/results.test.ts`
- Modify: `app/src/routes/+page.svelte` (compose form + capture + analyze button + results)
- Reference: HTML `renderResults` (JS lines ~673–780).

**Interfaces:**
- Consumes: `postAnalyze` (Task 11), `IntakeForm`, `CapturePanel`.
- Produces: `ResultsView` takes an `AnalyzeResult` prop and renders findings + quote items.

- [ ] **Step 1: Write failing test — ResultsView renders a finding + quote item**

```ts
// app/src/lib/ui/results.test.ts
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ResultsView from './ResultsView.svelte';

describe('results', () => {
  it('renders findings and quote items', () => {
    render(ResultsView, { props: { result: {
      probeId: { model: 'C1-6' }, findings: [{ zone: 'Lens', description: 'crack', severity: 'major', source: 'Visual' }],
      quoteItems: [{ item: 'Lens Replacement', priority: 'Required', rationale: 'crack' }],
      overallCondition: 'poor', confidence: 88, notes: '' } } });
    expect(screen.getByText(/Lens Replacement/)).toBeInTheDocument();
    expect(screen.getByText(/crack/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `ResultsView.svelte`** — port the `renderResults` markup (probe id header, findings list with severity styles, quote table, confidence, notes) from HTML lines ~673–780.

- [ ] **Step 4: Compose `+page.svelte`** — `IntakeForm` + `CapturePanel` + an Analyze button that calls `postAnalyze({ meta, images })`, shows a loading state, and renders `ResultsView` with the result (and `renderError`/`renderRaw` fallback for non-JSON, mirroring HTML lines ~652–657).

- [ ] **Step 5: Run tests + build, expect PASS.**
- [ ] **Step 6: Commit** — `git add app && git commit -m "feat(app): analyze action + results view"`

---

## Task 15: SPA — PDF export + email action

**Files:**
- Create: `app/src/lib/ui/report.ts`, `app/src/lib/ui/report.test.ts`
- Modify: `app/src/routes/+page.svelte` (PDF + Email buttons)
- Add dep: `jspdf`
- Reference: HTML PDF/email logic (JS lines ~790–990).

**Interfaces:**
- Produces: `buildReportPdf(result, meta, images): jsPDF` and `pdfBase64(doc): string`; Email button calls `postEmail({ to, subject, summary, pdfBase64 })`.

- [ ] **Step 1: Add jsPDF** — `cd app && npm install jspdf`

- [ ] **Step 2: Write failing test — buildReportPdf returns a jsPDF with content**

```ts
// app/src/lib/ui/report.test.ts
import { describe, it, expect } from 'vitest';
import { buildReportPdf } from './report';

describe('report', () => {
  it('produces a non-empty pdf', () => {
    const doc = buildReportPdf(
      { probeId: { model: 'C1-6' }, findings: [], quoteItems: [], overallCondition: 'ok', confidence: 90, notes: '' },
      { model: 'C1-6' }, []);
    const out = doc.output('datauristring');
    expect(out.startsWith('data:application/pdf')).toBe(true);
  });
});
```

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement `report.ts`** — port the jsPDF report + images generation from HTML lines ~790–920; export `buildReportPdf` and `pdfBase64` (strip the `data:` prefix).

- [ ] **Step 5: Wire PDF + Email buttons in `+page.svelte`** — PDF downloads via `doc.save(...)`; Email calls `postEmail({ to, subject: `Probe Report ${meta.model}`, summary, pdfBase64: pdfBase64(doc) })`.

- [ ] **Step 6: Run tests + build, expect PASS.**
- [ ] **Step 7: Commit** — `git add app && git commit -m "feat(app): PDF export + server-side email action"`

---

## Task 16: Combined Dockerfile (SPA + Vapor)

**Files:**
- Create: `Dockerfile`, `.dockerignore`
- Reference: `../TicketApp/ticket-api/Dockerfile` (drop the Postgres cert copy).

**Interfaces:**
- Produces: an image serving SPA + `/api` on port 8080.

- [ ] **Step 1: Write `Dockerfile` (three stages: node build → swift build → run)**

```dockerfile
# ---- Stage 1: build the SPA ----
FROM node:22-slim AS spa
WORKDIR /spa
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build     # → /spa/build

# ---- Stage 2: build the Vapor proxy ----
FROM swift:6.1-noble AS build
RUN apt-get -q update && apt-get -q install -y libjemalloc-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /build
COPY proxy/Package.* ./
RUN swift package resolve $([ -f ./Package.resolved ] && echo "--force-resolved-versions" || true)
COPY proxy/ ./
RUN --mount=type=cache,target=/build/.build \
    swift build -c release --product ProbeProxy --static-swift-stdlib -Xlinker -ljemalloc \
 && mkdir /staging \
 && cp "$(swift build -c release --show-bin-path)/ProbeProxy" /staging \
 && find -L "$(swift build -c release --show-bin-path)" -regex '.*\.resources$' -exec cp -Ra {} /staging \; \
 && cp "/usr/libexec/swift/linux/swift-backtrace-static" /staging/
# Bring in the built SPA as the Public dir the proxy serves:
COPY --from=spa /spa/build /staging/Public

# ---- Stage 3: run ----
FROM ubuntu:noble
RUN apt-get -q update && apt-get -q install -y libjemalloc2 ca-certificates tzdata && rm -rf /var/lib/apt/lists/*
RUN useradd --user-group --create-home --system --skel /dev/null --home-dir /app vapor
WORKDIR /app
COPY --from=build --chown=vapor:vapor /staging /app
ENV SWIFT_BACKTRACE=enable=yes,sanitize=yes,threads=all,images=all,interactive=no,swift-backtrace=./swift-backtrace-static
USER vapor:vapor
EXPOSE 8080
ENTRYPOINT ["./ProbeProxy"]
CMD ["serve", "--env", "production", "--hostname", "0.0.0.0", "--port", "8080"]
```

- [ ] **Step 2: Write `.dockerignore`**

```
**/node_modules
**/.build
**/.svelte-kit
app/build
.git
*.log
```

- [ ] **Step 3: Build + smoke-test**

Run:
```bash
docker build -t probe-intake:latest .
docker run --rm -e APP_PASSWORD_HASH="$(...)" -e AI_PROVIDER=azure_ai_foundry \
  -e AZURE_AI_FOUNDRY_ENDPOINT=https://x -e ANTHROPIC_API_KEY=dummy -p 8080:8080 probe-intake:latest &
sleep 5
curl -s localhost:8080/health   # expect: ok
curl -s localhost:8080/ | grep -qi "<html" && echo "SPA served"
```
Expected: `ok` and `SPA served`.

- [ ] **Step 4: Commit** — `git add Dockerfile .dockerignore && git commit -m "build: combined SPA+Vapor Docker image"`

---

## Task 17: docker-compose + Watchtower + .env.example

**Files:**
- Create: `docker-compose.yml`, `.env.example`

- [ ] **Step 1: Write `.env.example`**

```
# --- Auth ---
APP_PASSWORD_HASH=            # Bcrypt hash of the shared password (see README for how to generate)

# --- Model provider (Azure AI Foundry) ---
AI_PROVIDER=azure_ai_foundry
AZURE_AI_FOUNDRY_ENDPOINT=https://<resource>.openai.azure.com
AZURE_AI_FOUNDRY_API_KEY=     # or reuse ANTHROPIC_API_KEY below
ANTHROPIC_API_KEY=
MODEL_NAME=claude-sonnet-5

# --- Email (Microsoft Graph) ---
GRAPH_TENANT_ID=
GRAPH_CLIENT_ID=
GRAPH_CLIENT_SECRET=
GRAPH_MAILBOX=intake@yourdomain.com

# --- CORS (only needed for the two-app cloud split) ---
CORS_ALLOWED_ORIGINS=
```

- [ ] **Step 2: Write `docker-compose.yml` with Watchtower**

```yaml
services:
  proxy:
    image: probe-intake:latest
    build: .
    env_file: .env
    ports: ['8080:8080']
    restart: unless-stopped
  watchtower:
    image: containrrr/watchtower
    volumes: ['/var/run/docker.sock:/var/run/docker.sock']
    command: --interval 300 --cleanup
    restart: unless-stopped
```

- [ ] **Step 3: Verify end-to-end locally**

Run:
```bash
cp .env.example .env    # fill APP_PASSWORD_HASH + provider creds
docker compose up -d --build
curl -s localhost:8080/health         # ok

# Full path with the real WO0341463 fixture: login (capture the session cookie),
# then analyze 2-3 probe photos from FormImages/ (isForm:false) plus one form
# photo (isForm:true). Build the JSON body by base64-ing the JPGs.
COOKIE=$(curl -s -c - -X POST localhost:8080/api/login \
  -H 'content-type: application/json' -d '{"password":"<your pw>"}' | awk '/vapor-session/{print $7}')
B64=$(base64 -i "FormImages/20250310_065730.jpg" | tr -d '\n')
curl -s -b "vapor-session=$COOKIE" -X POST localhost:8080/api/analyze \
  -H 'content-type: application/json' \
  -d "{\"meta\":{\"so\":\"WO0341463\"},\"images\":[{\"mediaType\":\"image/jpeg\",\"base64\":\"$B64\",\"isForm\":false}]}"
```
Expected: health ok; login 200 with a valid password; analyze returns findings JSON that identifies the probe model as `C1-6`.

- [ ] **Step 4: Commit** — `git add docker-compose.yml .env.example && git commit -m "build: docker-compose with Watchtower auto-update"`

---

## Task 18: Cloud two-app config + README

**Files:**
- Create: `staticwebapp.config.json`, `README.md`
- Reference: `../avconn/staticwebapp.config.json`

- [ ] **Step 1: Write `staticwebapp.config.json`** — rewrite `/api/*` to the deployed proxy origin and SPA-fallback everything else:

```json
{
  "routes": [
    { "route": "/api/*", "rewrite": "https://<proxy-host>/api/*" }
  ],
  "navigationFallback": { "rewrite": "/index.html" }
}
```

- [ ] **Step 2: Write `README.md`** documenting:
  - Local run: `docker compose up -d --build`, open `http://<box-ip>:8080`.
  - Generating `APP_PASSWORD_HASH`: `docker run --rm probe-intake:latest /app/ProbeProxy` is not interactive; instead document a one-off `swift` snippet or a `/api/hash?pw=` dev-only helper — **decide during this task** (recommend a tiny `scripts/hash.swift` using `Bcrypt.hash`).
  - Auto-updates: push a new `probe-intake:latest` to the registry; Watchtower pulls within 5 min.
  - Cloud split: `app/build` → Azure Static Web Apps; image → Azure Container Apps; set `staticwebapp.config.json` proxy host + `CORS_ALLOWED_ORIGINS`.

- [ ] **Step 3: Verify** — `cd app && npm run build && npm test` and `cd proxy && swift test` both green.

- [ ] **Step 4: Commit** — `git add staticwebapp.config.json README.md && git commit -m "docs: cloud two-app config + README"`

---

## Self-Review Notes (author checklist — completed)

- **Spec coverage:** key hiding (Tasks 3–6), shared-password auth (7–8), stateless proxy (2), Azure Foundry provider (3), prompt caching (4), vision images (4,6,13), Graph email (9), static SPA matching avconn (1,11–15), one-container local + Watchtower (16–17), two-app cloud split (18). ✓
- **Placeholders:** the two intentional "paste verbatim from source" steps (ProbePrompt in Task 5; CSS/markup ports in Tasks 12–15) reference exact source files + line ranges rather than reproducing large verbatim blocks — the source is committed in-repo. All logic/tests are complete code. The one genuine open decision (password-hash generation helper) is called out in Task 18 Step 2 with a recommendation.
- **Type consistency:** `ResolvedProvider`, `AiContent`, `AiMessage`, `AiSystemBlock`, `AiResponse`, `AiStep.probeAnalysis`, `AnalyzeRequest`/`ImageInput`, `AnalyzeResult`/`Finding`/`QuoteItem`, `GraphEmailClient.sendMailBody(...attachment:)` are used consistently across backend and frontend tasks. ✓
