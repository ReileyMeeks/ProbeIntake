// proxy/Sources/ProbeProxy/Controllers/ExtractController.swift
import Vapor

struct ExtractImageInput: Content { var mediaType: String; var base64: String }
struct ExtractRequest: Content { var images: [ExtractImageInput] }

/// `POST /api/extract` — reads the uploaded inspection-form image(s) and
/// returns the probe's identifying fields as JSON, so the intake metadata
/// fields can be auto-filled. Best-effort from the caller's point of view
/// (the frontend never surfaces failures to the tech); stateless: no
/// persistence. Gated by `AuthGate` (see routes.swift).
struct ExtractController {
    func extract(_ req: Request) async throws -> Response {
        guard let ai = req.aiClient else { throw Abort(.serviceUnavailable, reason: "AI provider not configured") }
        let input = try req.content.decode(ExtractRequest.self)

        var content: [AiContent] = input.images.map { .image(mediaType: $0.mediaType, base64: $0.base64) }
        content.append(.text("Extract the probe identification fields from this evaluation/work-order form."))

        do {
            let resp = try await ai.send(step: .extractForm, modelOverride: nil,
                                         systemBase: ProbeExtractPrompt.system, userContent: content)
            // Same guarded {...} slice AnalyzeController uses, so downstream parsing is unchanged.
            var raw = resp.text
            if let s = raw.firstIndex(of: "{"), let e = raw.lastIndex(of: "}"), s <= e { raw = String(raw[s...e]) }
            let body = Response.Body(string: raw)
            return Response(status: .ok, headers: ["content-type": "application/json"], body: body)
        } catch let AiError.rateLimited(retryAfter) {
            throw Abort(.tooManyRequests, reason: "Rate limited\(retryAfter.map { "; retry after \($0)s" } ?? "")")
        } catch {
            req.logger.error("extract failed: \(error)")
            return errorJSON(status: .badGateway, message: "Upstream model request failed")
        }
    }

    private func errorJSON(status: HTTPStatus, message: String) -> Response {
        let escaped = message.replacingOccurrences(of: "\"", with: "'")
        return Response(status: status, headers: ["content-type": "application/json"],
                        body: .init(string: #"{"error":{"message":"\#(escaped)"}}"#))
    }
}
