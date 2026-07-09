// proxy/Sources/ProbeProxy/configure.swift
import Vapor

public func configure(_ app: Application) async throws {
    configureAiClient(app)
    configureGraphEmail(app)
    // Memory driver: single-instance deployment, no external session store.
    app.middleware.use(app.sessions.middleware)
    try routes(app)

    // Serve static SPA files AFTER API routes are registered
    app.middleware.use(FileMiddleware(publicDirectory: app.directory.publicDirectory, defaultFile: "index.html"))
}

// MARK: - AI client

/// Resolve provider creds (Anthropic or Azure AI Foundry) from the environment
/// and wire an `AiClient` onto the Application for `/api/analyze` to use.
///
/// Guarded: `ResolvedProvider.fromEnv()` throws when creds are missing (e.g.
/// CI, or a fresh checkout without a `.env`). We must NOT let that crash boot
/// — `/health` still needs to come up green. Instead we log a warning and
/// leave `app.aiClient` nil; `/api/analyze` responds 503 until creds are set.
private func configureAiClient(_ app: Application) {
    do {
        let provider = try ResolvedProvider.fromEnv()
        app.aiClient = AiClient(provider: provider, client: app.client, logger: app.logger)
    } catch {
        app.logger.warning(
            "ai client not configured — /api/analyze will return 503 until provider creds are set",
            metadata: ["error": "\(error)"]
        )
    }
}

// MARK: - Graph email client

/// Resolve Microsoft Graph app-only creds from the environment and wire a
/// `GraphEmailClient` onto the Application for `/api/email` to use.
///
/// Guarded like `configureAiClient`: creds are optional (e.g. CI, or a fresh
/// checkout without a `.env`), so a missing var must not crash boot —
/// `app.graphEmail` stays nil and `/api/email` responds 503 until all three
/// are set.
private func configureGraphEmail(_ app: Application) {
    guard let tenant = Environment.get("GRAPH_TENANT_ID"),
          let clientId = Environment.get("GRAPH_CLIENT_ID"),
          let secret = Environment.get("GRAPH_CLIENT_SECRET") else {
        app.logger.warning(
            "graph email client not configured — /api/email will return 503 until GRAPH_TENANT_ID/GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET are set"
        )
        return
    }
    app.graphEmail = GraphEmailClient(
        tenantId: tenant, clientId: clientId, clientSecret: secret,
        client: app.client, logger: app.logger
    )
}
