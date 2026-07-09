// proxy/Sources/ProbeProxy/Controllers/EmailController.swift
import Vapor

/// `POST /api/email` — sends the finished probe report (summary text + an
/// optional PDF attachment) via the configured Microsoft Graph mailbox.
/// Gated by `AuthGate`; replaces the old client-side EmailJS flow.
struct EmailController {
    struct Body: Content { var to: String; var subject: String; var summary: String; var pdfBase64: String? }

    func send(_ req: Request) async throws -> HTTPStatus {
        guard let graph = req.application.graphEmail else {
            throw Abort(.serviceUnavailable, reason: "Email not configured")
        }
        let body = try req.content.decode(Body.self)
        let mailbox = Environment.get("GRAPH_MAILBOX") ?? ""
        try await graph.sendMail(
            mailbox: mailbox, to: body.to, subject: body.subject, body: body.summary,
            attachment: body.pdfBase64.map { ("probe-report.pdf", $0) }
        )
        return .ok
    }
}
