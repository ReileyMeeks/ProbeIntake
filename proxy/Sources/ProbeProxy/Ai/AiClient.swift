import Vapor

/// Content block: text or a base64 image (Anthropic Messages API `content` array form).
///
/// ProbeIntake is vision-heavy (photos of drill probes/logs), so unlike
/// ticket-api's plain-string `AiMessage.content`, this proxy's user message
/// content is always an array of typed blocks so image + text can be mixed
/// in a single message.
enum AiContent: Codable, Sendable {
    case text(String)
    case image(mediaType: String, base64: String)

    private enum K: String, CodingKey { case type, text, source }
    private enum SourceK: String, CodingKey { case type, media_type, data }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: K.self)
        switch self {
        case .text(let t):
            try c.encode("text", forKey: .type); try c.encode(t, forKey: .text)
        case .image(let mt, let b64):
            try c.encode("image", forKey: .type)
            var s = c.nestedContainer(keyedBy: SourceK.self, forKey: .source)
            try s.encode("base64", forKey: .type)
            try s.encode(mt, forKey: .media_type)
            try s.encode(b64, forKey: .data)
        }
    }
    init(from decoder: Decoder) throws {   // decode not used server-side; minimal
        let c = try decoder.container(keyedBy: K.self)
        if try c.decode(String.self, forKey: .type) == "text" {
            self = .text(try c.decode(String.self, forKey: .text))
        } else {
            let s = try c.nestedContainer(keyedBy: SourceK.self, forKey: .source)
            self = .image(mediaType: try s.decode(String.self, forKey: .media_type),
                          base64: try s.decode(String.self, forKey: .data))
        }
    }
}

struct AiMessage: Codable, Sendable { var role: String; var content: [AiContent] }

/// One block of the system prompt. Anthropic accepts either a plain string
/// for `system` OR an array of typed blocks with optional `cache_control`.
/// We always use the array form so the base prompt can be cached.
struct AiSystemBlock: Codable, Sendable {
    var type: String; var text: String; var cacheControl: CacheControl?
    init(text: String, cacheControl: CacheControl? = nil) { self.type = "text"; self.text = text; self.cacheControl = cacheControl }
    enum CodingKeys: String, CodingKey { case type, text, cacheControl = "cache_control" }
    struct CacheControl: Codable, Sendable { var type: String; static let ephemeral = CacheControl(type: "ephemeral") }
}

struct AiResponse: Codable, Sendable {
    struct ContentBlock: Codable, Sendable { var type: String; var text: String? }
    var content: [ContentBlock]
    var text: String { content.compactMap(\.text).joined() }
}

enum AiError: Swift.Error, Sendable {
    case transport(String), rateLimited(retryAfter: TimeInterval?), parseFailed(String)
}

/// Anthropic / Azure AI Foundry HTTP client.
///
/// Both providers expose the same Messages API body shape; the only
/// differences are base URL + auth header, which `ResolvedProvider` captures.
struct AiClient: Sendable {
    let provider: ResolvedProvider
    let client: any Client
    let logger: Logger

    func send(step: AiStep, modelOverride: String?, systemBase: String, userContent: [AiContent]) async throws -> AiResponse {
        let model = AiModels.model(for: step, override: modelOverride ?? provider.forcedModel)
        let body = RequestBody(
            model: model,
            max_tokens: AiModels.maxTokens(for: step),
            temperature: AiModels.temperature(for: step),
            system: [AiSystemBlock(text: systemBase, cacheControl: .ephemeral)],
            messages: [AiMessage(role: "user", content: userContent)]
        )
        let data = try JSONEncoder().encode(body)
        var headers = HTTPHeaders()
        headers.add(name: provider.authHeader.name, value: provider.authHeader.value)
        for (k, v) in provider.extraHeaders { headers.add(name: k, value: v) }
        headers.contentType = .json

        let res = try await client.post(URI(string: "\(provider.baseURL)/messages"), headers: headers) { $0.body = .init(data: data) }
        if res.status == .tooManyRequests {
            throw AiError.rateLimited(retryAfter: res.headers.first(name: "retry-after").flatMap(TimeInterval.init))
        }
        guard let buf = res.body else { throw AiError.transport("empty body, status \(res.status)") }
        guard res.status == .ok else { throw AiError.transport("status \(res.status): \(String(buffer: buf))") }
        do { return try JSONDecoder().decode(AiResponse.self, from: Data(buffer: buf)) }
        catch { throw AiError.parseFailed("decode failed: \(error)") }
    }
}

private struct RequestBody: Codable {
    var model: String; var max_tokens: Int; var temperature: Double
    var system: [AiSystemBlock]; var messages: [AiMessage]
}

struct AiClientStorageKey: StorageKey { typealias Value = AiClient }
extension Application { var aiClient: AiClient? { get { storage[AiClientStorageKey.self] } set { storage[AiClientStorageKey.self] = newValue } } }
extension Request { var aiClient: AiClient? { application.aiClient } }
