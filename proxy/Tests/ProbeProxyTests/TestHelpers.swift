// proxy/Tests/ProbeProxyTests/TestHelpers.swift
import VaporTesting
import Testing
@testable import ProbeProxy

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
///
/// Shared by any gated-route test (AnalyzeTests, EmailTests, ...) — don't
/// copy-paste this per suite.
func sessionCookie(_ app: Application) async throws -> String {
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
