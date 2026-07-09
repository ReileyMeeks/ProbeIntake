// proxy/Tests/ProbeProxyTests/SessionTests.swift
import VaporTesting
import Testing
@testable import ProbeProxy

@Suite struct SessionTests {
    @Test func session_without_cookie_returns_unauthorized() async throws {
        try await withApp(configure: configure) { app in
            try await app.testing().test(.GET, "api/session") { res async in
                #expect(res.status == .unauthorized)
            }
        }
    }

    @Test func session_with_cookie_returns_ok() async throws {
        try await withApp(configure: configure) { app in
            let cookie = try await sessionCookie(app)
            try await app.testing().test(.GET, "api/session", beforeRequest: { req in
                req.headers.replaceOrAdd(name: .cookie, value: cookie)
            }) { res async in
                #expect(res.status == .ok)
            }
        }
    }
}
