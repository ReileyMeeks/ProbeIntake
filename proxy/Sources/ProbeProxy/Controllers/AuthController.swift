// proxy/Sources/ProbeProxy/Controllers/AuthController.swift
import Vapor

/// Shared-password login. There is no per-user account model — a single
/// password (hashed at rest in `APP_PASSWORD_HASH`) gates access for anyone
/// who knows it. Successful login marks the session `authed`; `AuthGate`
/// checks that flag on protected routes.
struct AuthController {
    struct LoginBody: Content { var password: String }

    func login(_ req: Request) async throws -> Response {
        let body = try req.content.decode(LoginBody.self)
        guard let hash = Environment.get("APP_PASSWORD_HASH"), !hash.isEmpty,
              (try? Bcrypt.verify(body.password, created: hash)) == true else {
            throw Abort(.unauthorized, reason: "Invalid password")
        }
        req.session.data["authed"] = "1"
        return Response(status: .ok)
    }
}
