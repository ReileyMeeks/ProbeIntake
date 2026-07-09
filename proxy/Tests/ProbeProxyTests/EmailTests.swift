// proxy/Tests/ProbeProxyTests/EmailTests.swift
import VaporTesting
import Testing
import NIOCore
@testable import ProbeProxy

@Suite struct EmailTests {

    // MARK: sendMailBody (pure builder, no network)

    @Test func sendmail_body_includes_attachment_when_present() throws {
        let json = GraphEmailClient.sendMailBody(
            to: "a@b.com", subject: "Report",
            body: "See attached.", attachment: ("report.pdf", "QUJD"))
        #expect(json.contains("attachments"))
        #expect(json.contains("report.pdf"))
        #expect(json.contains("#microsoft.graph.fileAttachment"))
        #expect(json.contains("QUJD"))
    }

    @Test func sendmail_body_omits_attachments_key_when_nil() throws {
        let json = GraphEmailClient.sendMailBody(
            to: "a@b.com", subject: "Report", body: "See attached.", attachment: nil)
        #expect(!json.contains("attachments"))
        #expect(json.contains("a@b.com"))
        #expect(json.contains("Report"))
    }

    // MARK: /api/email wiring

    @Test func email_without_session_returns_unauthorized() async throws {
        try await withApp(configure: configure) { app in
            try await app.testing().test(.POST, "api/email",
                beforeRequest: { try $0.content.encode(["to": "a@b.com", "subject": "s", "summary": "b"]) }) { res async in
                #expect(res.status == .unauthorized)
            }
        }
    }

    @Test func email_without_configured_client_returns_service_unavailable() async throws {
        try await withApp(configure: configure) { app in
            // Boot may or may not have found real Graph creds on this
            // machine; force the unconfigured state explicitly so the test
            // doesn't depend on the environment it happens to run in.
            app.graphEmail = nil

            let cookie = try await sessionCookie(app)
            try await app.testing().test(.POST, "api/email", beforeRequest: { req in
                req.headers.replaceOrAdd(name: .cookie, value: cookie)
                try req.content.encode(["to": "a@b.com", "subject": "s", "summary": "b"])
            }) { res async in
                #expect(res.status == .serviceUnavailable)
            }
        }
    }

    @Test func email_with_configured_client_sends_and_returns_ok() async throws {
        try await withApp(configure: configure) { app in
            app.graphEmail = makeStubGraphEmail(app)

            let cookie = try await sessionCookie(app)
            try await app.testing().test(.POST, "api/email", beforeRequest: { req in
                req.headers.replaceOrAdd(name: .cookie, value: cookie)
                try req.content.encode([
                    "to": "a@b.com", "subject": "Probe report", "summary": "See attached.",
                    "pdfBase64": "QUJD",
                ])
            }) { res async in
                #expect(res.status == .ok)
            }
        }
    }
}

/// Builds a `GraphEmailClient` backed by a stub `Client` that satisfies both
/// the OAuth token fetch and the `sendMail` POST without any real network
/// call — used to exercise `EmailController` end-to-end (decode → sendMail →
/// .ok) the same way `AnalyzeTests`' `makeStubAiClient` exercises analyze.
private func makeStubGraphEmail(_ app: Application) -> GraphEmailClient {
    let stubClient: any Client = StubGraphClient(eventLoop: app.eventLoopGroup.next())
    return GraphEmailClient(tenantId: "tenant", clientId: "client", clientSecret: "secret",
                            client: stubClient, logger: app.logger)
}

/// Minimal `Client` conformance that answers the Graph token endpoint with a
/// canned bearer token and every other request (i.e. `sendMail`) with a bare
/// 202, regardless of the request body.
private struct StubGraphClient: Client {
    let eventLoop: any EventLoop

    func delegating(to eventLoop: any EventLoop) -> any Client {
        StubGraphClient(eventLoop: eventLoop)
    }

    func send(_ request: ClientRequest) -> EventLoopFuture<ClientResponse> {
        if request.url.string.contains("oauth2/v2.0/token") {
            var buffer = ByteBufferAllocator().buffer(capacity: 64)
            buffer.writeString(#"{"access_token":"stub-token","expires_in":3600}"#)
            return eventLoop.makeSucceededFuture(
                ClientResponse(status: .ok, headers: ["content-type": "application/json"], body: buffer))
        }
        return eventLoop.makeSucceededFuture(ClientResponse(status: .accepted))
    }
}
