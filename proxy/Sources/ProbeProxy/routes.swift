// proxy/Sources/ProbeProxy/routes.swift
import Vapor

func routes(_ app: Application) throws {
    app.get("health") { _ in "ok" }

    let api = app.grouped("api")
    api.post("login", use: AuthController().login)

    let gated = api.grouped(AuthGate())
    gated.post("analyze", use: AnalyzeController().analyze)
    gated.post("email", use: EmailController().send)

    // SPA client-side route: serve index.html for /login
    app.get("login") { req async -> Response in
        let indexPath = app.directory.publicDirectory + "index.html"
        do {
            return try await req.fileio.asyncStreamFile(at: indexPath)
        } catch {
            return Response(status: .notFound)
        }
    }
}
