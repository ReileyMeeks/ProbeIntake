import Testing
import Vapor
@testable import ProbeProxy

@Suite(.serialized) struct ProviderTests {
    @Test func azure_foundry_builds_bearer_and_anthropic_v1() throws {
        setenv("AI_PROVIDER", "azure_ai_foundry", 1)
        setenv("AZURE_AI_FOUNDRY_ENDPOINT", "https://x.openai.azure.com", 1)
        setenv("AZURE_AI_FOUNDRY_API_KEY", "az-key", 1)
        setenv("MODEL_NAME", "claude-sonnet-5", 1)
        let p = try ResolvedProvider.fromEnv()
        #expect(p.baseURL == "https://x.openai.azure.com/anthropic/v1")
        #expect(p.authHeader.name == "Authorization")
        #expect(p.authHeader.value == "Bearer az-key")
        #expect(p.defaultModel == "claude-sonnet-5")
    }

    @Test func anthropic_direct_builds_x_api_key() throws {
        setenv("AI_PROVIDER", "anthropic", 1)
        setenv("ANTHROPIC_API_KEY", "sk-ant-test", 1)
        unsetenv("MODEL_NAME")
        let p = try ResolvedProvider.fromEnv()
        #expect(p.baseURL == "https://api.anthropic.com/v1")
        #expect(p.authHeader.name == "x-api-key")
    }
}
