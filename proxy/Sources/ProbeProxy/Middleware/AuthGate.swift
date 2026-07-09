// proxy/Sources/ProbeProxy/Middleware/AuthGate.swift
import Vapor

/// Blocks any request whose session isn't marked `authed` (set by
/// `AuthController.login`). Wired onto `/api/analyze` and `/api/email` in
/// routes.swift.
struct AuthGate: AsyncMiddleware {
    func respond(to req: Request, chainingTo next: any AsyncResponder) async throws -> Response {
        guard req.session.data["authed"] == "1" else { throw Abort(.unauthorized) }
        return try await next.respond(to: req)
    }
}
