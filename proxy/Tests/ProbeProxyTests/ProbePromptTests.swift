import Testing
@testable import ProbeProxy

@Suite struct ProbePromptTests {
    @Test func prompt_contains_rules_and_json_schema() {
        let s = ProbePrompt.system
        #expect(s.contains("BUNDLING RULES"))
        #expect(s.contains("Retermination"))
        #expect(s.contains("\"quoteItems\""))
        #expect(s.contains("Respond ONLY with valid JSON"))
    }
}
