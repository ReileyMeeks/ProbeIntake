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

    @Test func analyze_omits_deprecated_temperature_field_from_outgoing_request() async throws {
        try await withApp(configure: configure) { app in
            // claude-sonnet-5 rejects the `temperature` field with
            // 400 "temperature is deprecated for this model." — assert the
            // outgoing Messages API request body never includes it.
            let capture = CapturedRequestBody()
            app.aiClient = makeCapturingStubAiClient(app, capture: capture, returning:
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
            }

            let body = capture.body ?? ""
            #expect(body.contains("\"model\""))
            #expect(body.contains("\"system\""))
            #expect(body.contains("\"messages\""))
            #expect(!body.contains("\"temperature\""), "outgoing request must omit deprecated temperature field: \(body)")
        }
    }

    @Test func analyze_accepts_large_payloads_beyond_default_16kb_limit() async throws {
        try await withApp(configure: configure) { app in
            // Verify that the max body size limit has been raised from default 16kb.
            // A large base64 image payload (~200KB) should reach the controller and return 200,
            // not be rejected by Vapor with 413 Payload Too Large.
            app.aiClient = makeStubAiClient(app, returning:
                #"{"content":[{"type":"text","text":"{\"findings\":[],\"quoteItems\":[],\"confidence\":85}"}]}"#)

            let cookie = try await sessionCookie(app)
            let largeBase64 = String(repeating: "QUJD", count: 50_000)
            let payload = AnalyzeRequest(
                meta: ["model": "C1-6"],
                images: [ImageInput(mediaType: "image/jpeg", base64: largeBase64, isForm: false)]
            )

            try await app.testing().test(.POST, "api/analyze", beforeRequest: { req in
                req.headers.replaceOrAdd(name: .cookie, value: cookie)
                try req.content.encode(payload)
            }) { res async in
                #expect(res.status == .ok, "Large payload (200KB+) should be accepted, not rejected with 413")
                #expect(res.body.string.contains("\"confidence\""))
            }
        }
    }
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
    /// Optional reference-type holder so callers can inspect the outgoing
    /// request body after the call completes (this stub itself is a value
    /// type, so it can't retain mutable state on its own).
    var capture: CapturedRequestBody? = nil

    func delegating(to eventLoop: any EventLoop) -> any Client {
        StubMessagesClient(eventLoop: eventLoop, responseBody: responseBody, capture: capture)
    }

    func send(_ request: ClientRequest) -> EventLoopFuture<ClientResponse> {
        if let capture, let reqBody = request.body {
            capture.body = String(buffer: reqBody)
        }
        var buffer = ByteBufferAllocator().buffer(capacity: responseBody.utf8.count)
        buffer.writeString(responseBody)
        let response = ClientResponse(status: .ok, headers: ["content-type": "application/json"], body: buffer)
        return eventLoop.makeSucceededFuture(response)
    }
}

/// Reference-type holder that captures the outgoing `ClientRequest` body so
/// tests can assert on it after `send` completes.
private final class CapturedRequestBody: @unchecked Sendable {
    var body: String?
}

/// Builds an `AiClient` backed by a stub `Client` that captures the outgoing
/// request body into `capture` while returning `body` as a 200 response.
private func makeCapturingStubAiClient(_ app: Application, capture: CapturedRequestBody, returning body: String) -> AiClient {
    let provider = ResolvedProvider(
        kind: .anthropic,
        baseURL: "https://stub.invalid/v1",
        authHeader: ("x-api-key", "stub-key"),
        extraHeaders: [],
        defaultModel: "claude-sonnet-5",
        forcedModel: nil
    )
    let stubClient: any Client = StubMessagesClient(eventLoop: app.eventLoopGroup.next(), responseBody: body, capture: capture)
    return AiClient(provider: provider, client: stubClient, logger: app.logger)
}
