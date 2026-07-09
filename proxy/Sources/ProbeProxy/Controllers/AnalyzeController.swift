// proxy/Sources/ProbeProxy/Controllers/AnalyzeController.swift
import Vapor

struct ImageInput: Content { var mediaType: String; var base64: String; var isForm: Bool }
struct AnalyzeRequest: Content { var meta: [String: String]; var images: [ImageInput] }

/// `POST /api/analyze` — relays probe/form images + metadata to the configured
/// vision model and returns its parsed JSON verdict. Stateless: no persistence.
/// Gated by `AuthGate` (see routes.swift).
struct AnalyzeController {
    func analyze(_ req: Request) async throws -> Response {
        guard let ai = req.aiClient else { throw Abort(.serviceUnavailable, reason: "AI provider not configured") }
        let input = try req.content.decode(AnalyzeRequest.self)

        var content: [AiContent] = input.images.map { .image(mediaType: $0.mediaType, base64: $0.base64) }
        let probeCount = input.images.filter { !$0.isForm }.count
        let formCount = input.images.filter { $0.isForm }.count
        let metaLine = input.meta.map { "\($0.key)=\($0.value)" }.sorted().joined(separator: ", ")
        content.append(.text("""
        Analyze and generate quote.
        Probe: \(metaLine)
        Inputs: \(probeCount) probe images and \(formCount) form photos.
        Synthesize into unified findings and quote.
        """))

        do {
            let resp = try await ai.send(step: .probeAnalysis, modelOverride: nil,
                                         systemBase: ProbePrompt.system, userContent: content)
            // Same {...} slice the HTML did, so downstream parsing is unchanged.
            var raw = resp.text
            if let s = raw.firstIndex(of: "{"), let e = raw.lastIndex(of: "}"), s <= e { raw = String(raw[s...e]) }
            let body = Response.Body(string: raw)
            return Response(status: .ok, headers: ["content-type": "application/json"], body: body)
        } catch let AiError.rateLimited(retryAfter) {
            throw Abort(.tooManyRequests, reason: "Rate limited\(retryAfter.map { "; retry after \($0)s" } ?? "")")
        } catch {
            req.logger.error("analyze failed: \(error)")
            return errorJSON(status: .badGateway, message: "Upstream model request failed")
        }
    }

    private func errorJSON(status: HTTPStatus, message: String) -> Response {
        let escaped = message.replacingOccurrences(of: "\"", with: "'")
        return Response(status: status, headers: ["content-type": "application/json"],
                        body: .init(string: #"{"error":{"message":"\#(escaped)"}}"#))
    }
}
