// proxy/Tests/ProbeProxyTests/ExtractTests.swift
import VaporTesting
import Testing
import NIOCore
@testable import ProbeProxy

@Suite struct ExtractTests {
    @Test func extract_returns_parsed_fields_from_model() async throws {
        try await withApp(configure: configure) { app in
            app.aiClient = makeStubAiClient(app, returning:
                #"{"content":[{"type":"text","text":"{\"model\":\"C1-6-D\",\"sn\":\"250840YP6\",\"ref\":\"\",\"mfg\":\"\",\"so\":\"\",\"customer\":\"\",\"evalDate\":\"\"}"}]}"#)

            let cookie = try await sessionCookie(app)
            let payload = ExtractRequest(images: [ExtractImageInput(mediaType: "image/jpeg", base64: "QUJD")])

            try await app.testing().test(.POST, "api/extract", beforeRequest: { req in
                req.headers.replaceOrAdd(name: .cookie, value: cookie)
                try req.content.encode(payload)
            }) { res async in
                #expect(res.status == .ok)
                #expect(res.body.string.contains("\"model\":\"C1-6-D\""))
                #expect(res.body.string.contains("\"sn\":\"250840YP6\""))
            }
        }
    }

    @Test func extract_without_session_returns_unauthorized() async throws {
        try await withApp(configure: configure) { app in
            app.aiClient = makeStubAiClient(app, returning:
                #"{"content":[{"type":"text","text":"{\"model\":\"\"}"}]}"#)

            let payload = ExtractRequest(images: [ExtractImageInput(mediaType: "image/jpeg", base64: "QUJD")])
            try await app.testing().test(.POST, "api/extract", beforeRequest: { req in
                try req.content.encode(payload)
            }) { res async in
                #expect(res.status == .unauthorized)
            }
        }
    }

    @Test func extract_without_configured_client_returns_service_unavailable() async throws {
        try await withApp(configure: configure) { app in
            app.aiClient = nil

            let cookie = try await sessionCookie(app)
            let payload = ExtractRequest(images: [])
            try await app.testing().test(.POST, "api/extract", beforeRequest: { req in
                req.headers.replaceOrAdd(name: .cookie, value: cookie)
                try req.content.encode(payload)
            }) { res async in
                #expect(res.status == .serviceUnavailable)
            }
        }
    }
}

/// Builds an `AiClient` backed by a stub `Client` that always returns
/// `body` as a 200 response — used so the controller can be exercised
/// end-to-end (decode → build content → call AiClient → slice JSON)
/// without making a real network call. Mirrors `AnalyzeTests`' helper of
/// the same shape (each gated-route test file keeps its own private copy).
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
