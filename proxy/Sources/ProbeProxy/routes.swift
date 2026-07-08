// proxy/Sources/ProbeProxy/routes.swift
import Vapor

func routes(_ app: Application) throws {
    app.get("health") { _ in "ok" }
}
