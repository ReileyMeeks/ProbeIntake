// proxy/Sources/ProbeProxy/routes.swift
import Vapor

func routes(_ app: Application) throws {
    app.get("health") { _ in "ok" }

    let api = app.grouped("api")
    let analyze = AnalyzeController()
    api.post("analyze", use: analyze.analyze)   // AuthGate added in Task 8
}
