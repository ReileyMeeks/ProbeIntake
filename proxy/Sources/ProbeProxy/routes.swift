// proxy/Sources/ProbeProxy/routes.swift
import Vapor

func routes(_ app: Application) throws {
    app.get("health") { _ in "ok" }

    let api = app.grouped("api")
    api.post("login", use: AuthController().login)

    // NOTE: /api/email is added under `gated` in Task 9.
    let gated = api.grouped(AuthGate())
    gated.post("analyze", use: AnalyzeController().analyze)
}
