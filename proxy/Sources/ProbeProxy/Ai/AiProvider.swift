import Vapor

enum AiProvider: String, Sendable {
    case anthropic
    case azureAiFoundry = "azure_ai_foundry"
}

struct ResolvedProvider: Sendable {
    enum Kind: Sendable { case anthropic, azureAiFoundry }
    var kind: Kind
    var baseURL: String
    var authHeader: (name: String, value: String)
    var extraHeaders: [(String, String)]
    var defaultModel: String
    var forcedModel: String?

    /// Resolve purely from env vars (no database — ProbeIntake is stateless).
    /// Mirrors ticket-api/AiProvider.current, without the ticket_ai_config row.
    static func fromEnv() throws -> ResolvedProvider {
        let provider = AiProvider(rawValue: Environment.get("AI_PROVIDER") ?? "azure_ai_foundry") ?? .azureAiFoundry
        let forcedModel = Environment.get("MODEL_NAME").flatMap { $0.isEmpty ? nil : $0 }
        let defaultModel = forcedModel ?? "claude-sonnet-5"

        switch provider {
        case .anthropic:
            guard let key = Environment.get("ANTHROPIC_API_KEY"), !key.isEmpty else {
                throw Abort(.internalServerError, reason: "ANTHROPIC_API_KEY missing")
            }
            return .init(
                kind: .anthropic,
                baseURL: "https://api.anthropic.com/v1",
                authHeader: ("x-api-key", key),
                extraHeaders: [
                    ("anthropic-version", "2023-06-01"),
                    ("anthropic-beta", "prompt-caching-2024-07-31"),
                ],
                defaultModel: defaultModel,
                forcedModel: forcedModel
            )
        case .azureAiFoundry:
            guard let endpoint = Environment.get("AZURE_AI_FOUNDRY_ENDPOINT"), !endpoint.isEmpty else {
                throw Abort(.internalServerError, reason: "AZURE_AI_FOUNDRY_ENDPOINT missing")
            }
            let key = Environment.get("AZURE_AI_FOUNDRY_API_KEY").flatMap { $0.isEmpty ? nil : $0 }
                ?? Environment.get("ANTHROPIC_API_KEY").flatMap { $0.isEmpty ? nil : $0 }
            guard let key else {
                throw Abort(.internalServerError, reason: "Set AZURE_AI_FOUNDRY_API_KEY or ANTHROPIC_API_KEY")
            }
            let trimmed = endpoint.hasSuffix("/") ? String(endpoint.dropLast()) : endpoint
            let base = trimmed.hasSuffix("/anthropic") ? trimmed : "\(trimmed)/anthropic"
            return .init(
                kind: .azureAiFoundry,
                baseURL: "\(base)/v1",
                authHeader: ("Authorization", "Bearer \(key)"),
                extraHeaders: [("anthropic-version", "2023-06-01")],
                defaultModel: defaultModel,
                forcedModel: forcedModel
            )
        }
    }
}
