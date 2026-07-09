// proxy/Tests/ProbeProxyTests/GateWiringTests.swift
import VaporTesting
import Testing
@testable import ProbeProxy

@Suite struct GateWiringTests {
    @Test func analyze_requires_session() async throws {
        try await withApp(configure: configure) { app in
            let payload = AnalyzeRequest(meta: [:], images: [])
            try await app.testing().test(.POST, "api/analyze",
                beforeRequest: { try $0.content.encode(payload) }) { res async in
                #expect(res.status == .unauthorized)
            }
        }
    }
}
