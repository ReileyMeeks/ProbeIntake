// proxy/Sources/ProbeProxy/routes.swift
import Vapor

func routes(_ app: Application) throws {
    app.get("health") { _ in "ok" }

    let api = app.grouped("api")
    api.post("login", use: AuthController().login)

    let gated = api.grouped(AuthGate())
    gated.post("analyze", use: AnalyzeController().analyze)
    gated.post("email", use: EmailController().send)
}
