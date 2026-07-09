import Foundation

enum AiStep: String, Sendable { case probeAnalysis = "probe_analysis", extractForm = "extract_form" }

enum AiModels {
    static func model(for step: AiStep, override: String?) -> String {
        if let override, !override.isEmpty { return override }
        switch step {
        case .probeAnalysis: return "claude-sonnet-5"   // vision + structured extraction
        case .extractForm: return "claude-haiku-4-5"    // cheap/fast — small, focused extraction
        }
    }
    static func maxTokens(for step: AiStep) -> Int {
        switch step {
        case .probeAnalysis: return 4096   // matches HTML max_tokens:4096
        case .extractForm: return 512
        }
    }
    /// `nil` omits the field entirely — safe across models (claude-sonnet-5
    /// rejects `temperature`: "temperature is deprecated for this model.").
    static func temperature(for step: AiStep) -> Double? {
        switch step {
        case .probeAnalysis: return nil
        case .extractForm: return nil
        }
    }
}
