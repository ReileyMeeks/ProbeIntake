// proxy/Tests/ProbeProxyTests/AuthTests.swift
import VaporTesting
import Testing
import Vapor
@testable import ProbeProxy

// `setenv("APP_PASSWORD_HASH", ...)` mutates process-global state, and Swift
// Testing runs suites in parallel by default — serialize this suite so the
// wrong/correct password test isn't racing another test's env mutation.
@Suite(.serialized) struct AuthTests {
    @Test func wrong_password_401_correct_200_and_cookie() async throws {
        setenv("APP_PASSWORD_HASH", try! Bcrypt.hash("hunter2"), 1)
        try await withApp(configure: configure) { app in
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
        try await withApp(configure: configure) { app in
            app.grouped(AuthGate()).get("protected") { _ in "secret" }
            try await app.testing().test(.GET, "protected") { res async in
                #expect(res.status == .unauthorized)
            }
        }
    }
}
