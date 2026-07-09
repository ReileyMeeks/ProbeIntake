// proxy/Sources/ProbeProxy/configure.swift
import Vapor

public func configure(_ app: Application) async throws {
    configureAiClient(app)
    try routes(app)
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
