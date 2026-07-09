import Foundation

enum AiStep: String, Sendable { case probeAnalysis = "probe_analysis" }

enum AiModels {
    static func model(for step: AiStep, override: String?) -> String {
        if let override, !override.isEmpty { return override }
        return "claude-sonnet-5"   // vision + structured extraction
    }
    static func maxTokens(for step: AiStep) -> Int { 4096 }   // matches HTML max_tokens:4096
    /// `nil` omits the field entirely (claude-sonnet-5 rejects `temperature`: "temperature is deprecated for this model.").
    static func temperature(for step: AiStep) -> Double? {
        switch step {
        case .probeAnalysis: return nil
        }
    }
}
