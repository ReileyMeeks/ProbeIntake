// proxy/Sources/ProbeProxy/Email/GraphEmailClient.swift
//
// Trimmed from ticket-api's GraphEmailClient (send-only): ProbeIntake only
// emails the finished probe report, it never reads inbound mail, so the
// delta-fetch / attachment-fetch / reply methods (and their supporting Graph
// response models) were dropped. `GraphTokenResponse` lived in ticket-api's
// GraphModels.swift alongside inbound-only types (GraphMessage,
// GraphAttachment, etc.) — rather than pull that whole file over, it's
// inlined below since it's the only piece this client still needs.
import Vapor
import Foundation

enum GraphError: Error, Sendable {
    case http(status: HTTPStatus, body: String)
    case rateLimited(retryAfter: TimeInterval?)
    case deltaExpired
    case noToken
}

/// Microsoft Graph client for app-only (client-credentials) mailbox access.
/// Token is fetched on demand and cached until shortly before expiry.
struct GraphEmailClient: Sendable {
    let tenantId: String
    let clientId: String
    let clientSecret: String
    let client: any Client
    let logger: Logger
    private let tokenCache = GraphTokenCache()

    init(tenantId: String, clientId: String, clientSecret: String, client: any Client, logger: Logger) {
        self.tenantId = tenantId
        self.clientId = clientId
        self.clientSecret = clientSecret
        self.client = client
        self.logger = logger
    }

    // MARK: URL + body builders (pure, unit-tested)

    static let base = "https://graph.microsoft.com/v1.0"

    static func tokenURL(tenantId: String) -> String {
        "https://login.microsoftonline.com/\(tenantId)/oauth2/v2.0/token"
    }
    static func sendMailURL(mailbox: String) -> String {
        "\(base)/users/\(mailbox)/sendMail"
    }

    static func tokenRequestBody(clientId: String, clientSecret: String) -> String {
        func enc(_ s: String) -> String {
            var cs = CharacterSet.alphanumerics
            cs.insert(charactersIn: "-._~")
            return s.addingPercentEncoding(withAllowedCharacters: cs) ?? s
        }
        return "client_id=\(enc(clientId))"
            + "&scope=\(enc("https://graph.microsoft.com/.default"))"
            + "&client_secret=\(enc(clientSecret))"
            + "&grant_type=client_credentials"
    }

    /// Pure builder for the `sendMail` JSON body — no network, no `self`, so
    /// it's directly unit-testable. When `attachment` is present, adds a
    /// single Graph `fileAttachment` (always `application/pdf` here, since
    /// the only attachment ProbeIntake ever sends is the rendered report).
    static func sendMailBody(to: String, subject: String, body: String,
                             attachment: (name: String, base64: String)?) -> String {
        var message: [String: Any] = [
            "subject": subject,
            "body": ["contentType": "Text", "content": body],
            "toRecipients": [["emailAddress": ["address": to]]],
        ]
        if let a = attachment {
            message["attachments"] = [[
                "@odata.type": "#microsoft.graph.fileAttachment",
                "name": a.name,
                "contentType": "application/pdf",
                "contentBytes": a.base64,
            ]]
        }
        let payload: [String: Any] = ["message": message, "saveToSentItems": true]
        let data = try! JSONSerialization.data(withJSONObject: payload)
        return String(decoding: data, as: UTF8.self)
    }

    // MARK: Token

    private func token() async throws -> String {
        if let cached = await tokenCache.valid() { return cached }
        let body = Self.tokenRequestBody(clientId: clientId, clientSecret: clientSecret)
        var headers = HTTPHeaders()
        headers.contentType = .urlEncodedForm
        let res = try await client.post(URI(string: Self.tokenURL(tenantId: tenantId)), headers: headers) { req in
            req.body = .init(string: body)
        }
        guard res.status == .ok, let buf = res.body else {
            throw GraphError.http(status: res.status, body: res.body.map { String(buffer: $0) } ?? "")
        }
        let decoded = try JSONDecoder().decode(GraphTokenResponse.self, from: Data(buffer: buf))
        await tokenCache.store(token: decoded.access_token, expiresIn: decoded.expires_in)
        return decoded.access_token
    }

    private func authHeaders() async throws -> HTTPHeaders {
        var h = HTTPHeaders()
        h.add(name: .authorization, value: "Bearer \(try await token())")
        h.add(name: .accept, value: "application/json")
        return h
    }

    private func mapThrottling(_ res: ClientResponse) -> GraphError? {
        if res.status == .tooManyRequests {
            let ra = res.headers.first(name: "Retry-After").flatMap(TimeInterval.init)
            return .rateLimited(retryAfter: ra)
        }
        return nil
    }

    // MARK: Outbound

    func sendMail(mailbox: String, to: String, subject: String, body: String,
                  attachment: (name: String, base64: String)? = nil) async throws {
        var headers = try await authHeaders()
        headers.contentType = .json
        let jsonBody = Self.sendMailBody(to: to, subject: subject, body: body, attachment: attachment)
        let res = try await client.post(URI(string: Self.sendMailURL(mailbox: mailbox)), headers: headers) { req in
            req.body = .init(string: jsonBody)
        }
        if let e = mapThrottling(res) { throw e }
        guard res.status == .accepted || res.status == .ok || res.status == .noContent else {
            throw GraphError.http(status: res.status, body: res.body.map { String(buffer: $0) } ?? "")
        }
    }
}

// MARK: - GraphTokenResponse

/// Inlined from ticket-api's GraphModels.swift — the one Graph response shape
/// this send-only client still needs to decode.
struct GraphTokenResponse: Codable, Sendable {
    let access_token: String
    let expires_in: Int
}

// MARK: - GraphTokenCache

/// Actor cache so concurrent callers share one token until ~60s before expiry.
actor GraphTokenCache {
    private var token: String?
    private var expiresAt: Date?

    func valid() -> String? {
        guard let token, let expiresAt, expiresAt > Date().addingTimeInterval(60) else { return nil }
        return token
    }

    func store(token: String, expiresIn: Int) {
        self.token = token
        self.expiresAt = Date().addingTimeInterval(TimeInterval(expiresIn))
    }
}

struct GraphStorageKey: StorageKey { typealias Value = GraphEmailClient }
extension Application { var graphEmail: GraphEmailClient? { get { storage[GraphStorageKey.self] } set { storage[GraphStorageKey.self] = newValue } } }
