// proxy/Tests/ProbeProxyTests/AnalyzeTests.swift
import VaporTesting
import Testing
import NIOCore
@testable import ProbeProxy

@Suite struct AnalyzeTests {
    @Test func analyze_returns_parsed_json_from_model() async throws {
        try await withApp(configure: configure) { app in
            app.aiClient = makeStubAiClient(app, returning:
                #"{"content":[{"type":"text","text":"{\"findings\":[],\"quoteItems\":[],\"confidence\":90}"}]}"#)

            let cookie = try await sessionCookie(app)
            let payload = AnalyzeRequest(
                meta: ["model": "C1-6"],
                images: [ImageInput(mediaType: "image/jpeg", base64: "QUJD", isForm: false)]
            )

            try await app.testing().test(.POST, "api/analyze", beforeRequest: { req in
                req.headers.replaceOrAdd(name: .cookie, value: cookie)
                try req.content.encode(payload)
            }) { res async in
                #expect(res.status == .ok)
                #expect(res.body.string.contains("\"confidence\""))
                #expect(res.body.string.contains("\"findings\""))
            }
        }
    }

    @Test func analyze_without_configured_client_returns_service_unavailable() async throws {
        try await withApp(configure: configure) { app in
            // Boot may or may not have found real provider creds on this
            // machine; force the unconfigured state explicitly so the test
            // doesn't depend on the environment it happens to run in.
            app.aiClient = nil

            let cookie = try await sessionCookie(app)
            let payload = AnalyzeRequest(meta: [:], images: [])
            try await app.testing().test(.POST, "api/analyze", beforeRequest: { req in
                req.headers.replaceOrAdd(name: .cookie, value: cookie)
                try req.content.encode(payload)
            }) { res async in
                #expect(res.status == .serviceUnavailable)
            }
        }
    }

    @Test func analyze_handles_reversed_braces_without_crashing() async throws {
        try await withApp(configure: configure) { app in
            // Model returns text where closing brace precedes opening brace.
            // This would have caused a fatal Range error before the fix.
            let malformedText = "} sorry, no json here {"
            app.aiClient = makeStubAiClient(app, returning:
                #"{"content":[{"type":"text","text":"\#(malformedText)"}]}"#)

            let cookie = try await sessionCookie(app)
            let payload = AnalyzeRequest(
                meta: ["model": "C1-6"],
                images: [ImageInput(mediaType: "image/jpeg", base64: "QUJD", isForm: false)]
            )

            try await app.testing().test(.POST, "api/analyze", beforeRequest: { req in
                req.headers.replaceOrAdd(name: .cookie, value: cookie)
                try req.content.encode(payload)
            }) { res async in
                #expect(res.status == .ok)
                // Confirms slice was not applied; malformed text echoed back unchanged
                #expect(res.body.string == malformedText)
            }
        }
    }
}

/// Mints an authenticated session and returns the `Cookie` header value
/// (`vapor-session=<value>`) needed to carry it onto a follow-up
/// `app.testing().test(...)` call — `.test()` calls are independent
/// request/response round-trips in VaporTesting, so the session cookie must
/// be extracted and threaded explicitly onto any request that needs to be
/// authenticated.
///
/// This deliberately does NOT go through `POST /api/login` (which requires
/// `setenv("APP_PASSWORD_HASH", ...)`): that's a process-global mutation,
/// Swift Testing runs suites concurrently by default, and `AuthTests`
/// mutates the same env var — sharing it here would be a data race between
/// suites (observed: intermittent `AuthTests` failures when both suites set
/// the env var in the same run). Instead this registers a test-only route
/// that sets `req.session.data["authed"] = "1"` — the exact same session
/// flag `AuthController.login` sets — so `AuthGate` is exercised for real,
/// without touching shared password state that belongs to `AuthTests`.
private func sessionCookie(_ app: Application) async throws -> String {
    app.get("test-only-mint-session") { req -> Response in
        req.session.data["authed"] = "1"
        return Response(status: .ok)
    }
    var cookie: String?
    try await app.testing().test(.GET, "test-only-mint-session") { res async in
        #expect(res.status == .ok)
        cookie = res.headers.setCookie?["vapor-session"]?.string
    }
    guard let cookie else {
        Issue.record("session route did not return a vapor-session cookie")
        return ""
    }
    return "vapor-session=\(cookie)"
}

/// Builds an `AiClient` backed by a stub `Client` that always returns
/// `body` as a 200 response — used so the controller can be exercised
/// end-to-end (decode → build content → call AiClient → slice JSON)
/// without making a real network call.
private func makeStubAiClient(_ app: Application, returning body: String) -> AiClient {
    let provider = ResolvedProvider(
        kind: .anthropic,
        baseURL: "https://stub.invalid/v1",
        authHeader: ("x-api-key", "stub-key"),
        extraHeaders: [],
        defaultModel: "claude-sonnet-5",
        forcedModel: nil
    )
    let stubClient: any Client = StubMessagesClient(eventLoop: app.eventLoopGroup.next(), responseBody: body)
    return AiClient(provider: provider, client: stubClient, logger: app.logger)
}

/// Minimal `Client` conformance whose `send` always succeeds with a canned
/// Anthropic Messages-API-shaped JSON body, regardless of the request.
private struct StubMessagesClient: Client {
    let eventLoop: any EventLoop
    let responseBody: String

    func delegating(to eventLoop: any EventLoop) -> any Client {
        StubMessagesClient(eventLoop: eventLoop, responseBody: responseBody)
    }

    func send(_ request: ClientRequest) -> EventLoopFuture<ClientResponse> {
        var buffer = ByteBufferAllocator().buffer(capacity: responseBody.utf8.count)
        buffer.writeString(responseBody)
        let response = ClientResponse(status: .ok, headers: ["content-type": "application/json"], body: buffer)
        return eventLoop.makeSucceededFuture(response)
    }
}
