// proxy/Tests/ProbeProxyTests/StaticTests.swift
import VaporTesting
import Testing
@testable import ProbeProxy

@Suite struct StaticTests {
    @Test func root_serves_index() async throws {
        try await withApp(configure: configure) { app in
            try await app.testing().test(.GET, "/") { res async in
                #expect(res.status == .ok)
                #expect(res.body.string.contains("<!DOCTYPE html>") || res.body.string.contains("<html"))
            }
        }
    }

    @Test func login_serves_index() async throws {
        try await withApp(configure: configure) { app in
            try await app.testing().test(.GET, "/login") { res async in
                #expect(res.status == .ok)
                #expect(res.body.string.contains("<!DOCTYPE html>") || res.body.string.contains("<html"))
            }
        }
    }

    @Test func health_still_works() async throws {
        try await withApp(configure: configure) { app in
            try await app.testing().test(.GET, "/health") { res async in
                #expect(res.status == .ok)
                #expect(res.body.string == "ok")
            }
        }
    }
}
