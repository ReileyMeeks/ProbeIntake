// proxy/Tests/ProbeProxyTests/HealthTests.swift
import VaporTesting
import Testing
@testable import ProbeProxy

@Suite struct HealthTests {
    @Test func health_returns_ok() async throws {
        try await withApp(configure: configure) { app in
            try await app.testing().test(.GET, "health") { res async in
                #expect(res.status == .ok)
                #expect(res.body.string == "ok")
            }
        }
    }
}
