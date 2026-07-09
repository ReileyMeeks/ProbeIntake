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

            let payload = AnalyzeRequest(
                meta: ["model": "C1-6"],
                images: [ImageInput(mediaType: "image/jpeg", base64: "QUJD", isForm: false)]
            )

            try await app.testing().test(.POST, "api/analyze", beforeRequest: { req in
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

            let payload = AnalyzeRequest(meta: [:], images: [])
            try await app.testing().test(.POST, "api/analyze", beforeRequest: { req in
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

            let payload = AnalyzeRequest(
                meta: ["model": "C1-6"],
                images: [ImageInput(mediaType: "image/jpeg", base64: "QUJD", isForm: false)]
            )

            try await app.testing().test(.POST, "api/analyze", beforeRequest: { req in
                try req.content.encode(payload)
            }) { res async in
                #expect(res.status == .ok)
                // Confirms slice was not applied; malformed text echoed back unchanged
                #expect(res.body.string == malformedText)
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
